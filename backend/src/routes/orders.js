const router = require('express').Router({ mergeParams: true });
const Order        = require('../models/Order');
const OrderItem    = require('../models/OrderItem');
const ServingGroup = require('../models/ServingGroup');
const MenuItem     = require('../models/MenuItem');
const WaiterCall   = require('../models/WaiterCall');
const Payment      = require('../models/Payment');
const Table        = require('../models/Table');
const Session      = require('../models/Session');
const User         = require('../models/User');
const Restaurant   = require('../models/Restaurant');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { requireSameRestaurant } = require('../middleware/restaurantParam');
const { notFound, badRequest, orderFinalized, orderPaidCannotCancel, sessionMismatch, orderAccessDenied, itemNotEditable, orderItemsBeingPrepared, invalidDishStatus, createError } = require('../middleware/validate');
const { recalcOrderStatus, recalcTableStatus, maybeFinalizeOpenPaidOrder } = require('../services/orderService');
const { emit } = require('../services/wsService');
const auditService = require('../services/auditService');
const { nextPublicId } = require('../utils/publicId');
const { createNotification } = require('../services/notificationService');
const { enrichOrderItems, loadMenuItemMapFor, enrichOrderItem } = require('../services/i18nOrderEnricher');

function respond(res, req, data) {
  res.json({ data, meta: { request_id: req.requestId } });
}

/**
 * Validates cart items against the current menu state.
 * Returns an array of per-item change objects, empty if everything is fine.
 * Each entry: { menuItemId, itemName, type, blocking, changes[] }
 */
async function validateCartItems(items, restaurantId) {
  const menuChanges = [];

  for (const it of items) {
    const menuItem = await MenuItem.findOne({ _id: it.menuItemId, restaurantId }).lean();

    if (!menuItem || menuItem.isDeleted) {
      menuChanges.push({
        menuItemId: String(it.menuItemId),
        itemName:   String(it.menuItemId),
        type:       'dish_removed',
        blocking:   true,
        changes:    [],
      });
      continue;
    }
    if (menuItem.isAvailable === false) {
      menuChanges.push({
        menuItemId: String(it.menuItemId),
        itemName:   menuItem.name,
        type:       'dish_unavailable',
        blocking:   true,
        changes:    [],
      });
      continue;
    }

    const itemChanges = [];
    let computedPrice = menuItem.basePrice || 0;

    for (const a of it.addons || []) {
      const addon = (menuItem.addons || []).find(x => x._id.toString() === String(a.addOnId));
      if (!addon || addon.isAvailable === false) {
        itemChanges.push({ kind: 'addon_removed', name: String(a.addOnId) });
      } else {
        computedPrice += addon.price || 0;
      }
    }

    for (const c of it.componentGroupChoices || []) {
      const group = (menuItem.componentGroups || []).find(g => g._id.toString() === String(c.groupId));
      if (!group || group.isAvailable === false) {
        itemChanges.push({ kind: 'group_removed', name: c.groupName || String(c.groupId) });
      } else {
        const option = (group.options || []).find(o => o._id.toString() === String(c.optionId));
        if (!option) {
          itemChanges.push({ kind: 'option_removed', groupName: group.name, name: c.optionName || String(c.optionId) });
        } else {
          computedPrice += option.priceModifier || 0;
        }
      }
    }

    // Compare total unit price if the client sent an expectation
    if (it.expectedUnitPrice !== undefined && Math.abs(computedPrice - it.expectedUnitPrice) > 0.01) {
      // Only add a generic price entry if no specific change already explains the diff
      const alreadyExplained = itemChanges.some(c => c.kind.includes('price'));
      if (!alreadyExplained) {
        itemChanges.push({ kind: 'base_price', oldPrice: it.expectedUnitPrice, newPrice: computedPrice });
      }
    }

    if (itemChanges.length > 0) {
      menuChanges.push({
        menuItemId: String(menuItem._id),
        itemName:   menuItem.name,
        type:       'modified',
        blocking:   false,
        changes:    itemChanges,
      });
    }
  }

  return menuChanges;
}

// POST /:restaurantId/orders — create order (guest with session token)
router.post('/', async (req, res, next) => {
  try {
    const { tableId, sessionToken, items, servingGroups: groupDefs } = req.body;
    if (!tableId || !sessionToken || !items?.length) {
      return next(badRequest('tableId, sessionToken and items are required'));
    }

    // ── Session validation ─────────────────────────────────────────────────
    const session = await Session.findOne({ token: sessionToken, isActive: true, tableId, restaurantId: req.restaurantId });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: { code: 'SESSION_INVALID', message: 'Invalid or expired session' }, meta: { request_id: req.requestId } });
    }

    // One active order per account — a user (or session) may only have one
    // non-terminal order across all restaurants at a time.
    // Authenticated users are identified by userId; guests by sessionToken.
    const TERMINAL = ['cancelled', 'completed_cash', 'completed_epay'];
    const accountFilter = req.user?._id
      ? { userId: req.user._id,  status: { $nin: TERMINAL } }
      : { sessionToken,          status: { $nin: TERMINAL } };
    const existingActive = await Order.findOne(accountFilter);
    if (existingActive) {
      return res.status(409).json({
        error: {
          code:                   'ACTIVE_ORDER_EXISTS',
          message:                'You already have an active order.',
          activeOrderId:          String(existingActive._id),
          activeOrderRestaurantId: String(existingActive.restaurantId),
        },
        meta: { request_id: req.requestId },
      });
    }

    const table = await Table.findOne({ _id: tableId, restaurantId: req.restaurantId });
    if (!table || table.status === 'disabled') return next(notFound('Table not available'));

    // ── Menu change validation ─────────────────────────────────────────────
    const menuChanges = await validateCartItems(items, req.restaurantId);
    if (menuChanges.length > 0) {
      return res.status(409).json({
        error: {
          code:     'MENU_CHANGED',
          message:  'Menu has changed since your cart was loaded',
          blocking: menuChanges.some(c => c.blocking),
          changes:  menuChanges,
        },
        meta: { request_id: req.requestId },
      });
    }

    const publicId = await nextPublicId(Order);
    const order = await Order.create({
      _id: publicId,
      tableId,
      restaurantId: req.restaurantId,
      sessionToken,
      userId: req.user?._id,
    });

    // Create named serving groups
    const groupMap = {};
    if (groupDefs?.length) {
      for (const gd of groupDefs) {
        const g = await ServingGroup.create({ orderId: order._id, name: gd.name, sortOrder: gd.sortOrder || 0 });
        groupMap[gd.name] = g._id;
      }
    }

    const defaultGroup = await ServingGroup.create({ orderId: order._id, name: 'Основна подача', sortOrder: 0 });
    const defaultGroupId = defaultGroup._id;

    const orderItems = [];
    for (const it of items) {
      const menuItem = await MenuItem.findOne({ _id: it.menuItemId, restaurantId: req.restaurantId, isAvailable: true, isDeleted: false });
      if (!menuItem) return next(badRequest(`Menu item ${it.menuItemId} not found or unavailable`));

      const servingGroupId = it.servingGroupId ? (groupMap[it.servingGroupId] || defaultGroupId) : defaultGroupId;

      // Snapshot addons from embedded dish data
      const addonsData = [];
      if (it.addons?.length) {
        for (const a of it.addons) {
          const embedded = menuItem.addons.find(x => x._id.toString() === String(a.addOnId));
          if (embedded && embedded.isAvailable !== false) {
            addonsData.push({
              _id:      embedded._id,
              name:     embedded.name,
              price:    embedded.price,
              quantity: a.quantity || 1,
            });
          }
        }
      }

      // Snapshot excluded ingredients from embedded dish data
      const excludedIngredients = [];
      if (it.excludedIngredients?.length) {
        for (const eid of it.excludedIngredients) {
          const embedded = menuItem.ingredients.find(x => x._id.toString() === String(eid));
          if (embedded && embedded.isRemovable !== false) {
            excludedIngredients.push({ _id: embedded._id, name: embedded.name });
          }
        }
      }

      // Snapshot component group choices from embedded dish data
      const componentGroupChoices = [];
      if (it.componentGroupChoices?.length) {
        for (const choice of it.componentGroupChoices) {
          const group = menuItem.componentGroups.find(g => g._id.toString() === String(choice.groupId));
          if (!group || group.isAvailable === false) continue;
          const option = group.options.find(o => o._id.toString() === String(choice.optionId));
          if (!option) continue;
          componentGroupChoices.push({
            groupId:       group._id,
            groupName:     group.name,
            optionId:      option._id,
            optionName:    option.name,
            priceModifier: option.priceModifier || 0,
          });
        }
      }

      const oi = await OrderItem.create({
        orderId: order._id,
        servingGroupId,
        menuItemId: it.menuItemId,
        menuItemName: menuItem.name,
        quantity: it.qty || 1,
        unitPrice: menuItem.basePrice,
        excludedIngredients,
        addons: addonsData,
        componentGroupChoices,
        comment: it.comment,
      });
      orderItems.push(oi);
    }

    if (table.status === 'free') {
      table.status = 'occupied';
      await table.save();
    }

    const groups = await ServingGroup.find({ orderId: order._id }).lean();

    emit(`kitchen:${req.restaurantId}`, 'ORDER_NEW', {
      orderId: order._id,
      tableId, tableNumber: table.number,
      servingGroups: groups.map((g) => ({
        id: g._id, name: g.name,
        items: orderItems.filter((i) => i.servingGroupId.toString() === g._id.toString()),
      })),
      createdAt: order.createdAt,
    });
    emit(`waiter:${req.restaurantId}`, 'ORDER_NEW', {
      orderId: order._id,
      tableId, tableNumber: table.number, createdAt: order.createdAt,
    });

    // Format response identically to GET /orders/:id so normalizeApiOrder works correctly
    const leanItems = orderItems.map(oi => oi.toObject ? oi.toObject() : oi);
    const enriched  = await enrichOrderItems(leanItems);
    const formattedItems = enriched.map(oi => {
      const lineTotal = oi.unitPrice * oi.quantity;
      return {
        _id:            oi._id,
        menuItemId:     oi.menuItemId,                              // { _id, name, name_en }
        qty:            oi.quantity,
        totalPrice:     Math.round(lineTotal * 100) / 100,
        dishStatus:     oi.dishStatus,
        servingGroupId: oi.servingGroupId,
        comment:        oi.comment,
      };
    });
    const totalAmount = formattedItems.reduce((s, i) => s + i.totalPrice, 0);

    respond(res, req, {
      order: {
        _id:         order._id,
        publicId:    order._id,
        status:      order.status,
        tableNumber: table.number ?? null,
        totalAmount: Math.round(totalAmount * 100) / 100,
        createdAt:   order.createdAt,
      },
      servingGroups: groups,
      items:         formattedItems,
    });
  } catch (err) { next(err); }
});

// GET /:restaurantId/orders/:orderId
router.get('/:orderId', optionalAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId }).lean();
    if (!order) return next(notFound('Order not found'));

    const sessionToken  = req.cookies?.session_token || req.headers['x-session-token'];
    const isStaff       = req.user && ['waiter', 'cook', 'admin', 'root_admin'].includes(req.user.role);
    const isOwner       = sessionToken && order.sessionToken === sessionToken;
    const isAuthGuest   = req.user && order.userId?.toString() === req.user._id.toString();

    if (!isStaff && !isOwner && !isAuthGuest) {
      return next(orderAccessDenied());
    }

    const [rawItems, groups, table, orderUser, restaurant] = await Promise.all([
      OrderItem.find({ orderId: order._id }).lean(),
      ServingGroup.find({ orderId: order._id }).lean(),
      Table.findById(order.tableId).select('number').lean(),
      order.userId
        ? User.findById(order.userId).select('name email role').lean()
        : Promise.resolve(null),
      Restaurant.findById(order.restaurantId).select('name translations plan').lean(),
    ]);

    // Enrich raw items with name_en (dish + nested ingredients/addons/options)
    // before mapping to the API response shape. This replicates the /staff/map
    // join pattern so the frontend can switch language without re-fetching.
    const enrichedItems = await enrichOrderItems(rawItems);
    const items = enrichedItems.map((i) => {
      const compMod  = (i.componentGroupChoices || []).reduce((s, c) => s + (c.priceModifier || 0), 0);
      const aoTotal  = (i.addons || []).reduce((s, a) => s + (a.price || 0) * (a.quantity || 1), 0);
      const lineTotal = (i.unitPrice + compMod) * i.quantity + aoTotal;
      return {
        _id:                   i._id,
        menuItemId:            i.menuItemId,                       // { _id, name, name_en, categoryId? }
        menuItemId_raw:        String(i.menuItemId?._id || i.menuItemId),
        qty:                   i.quantity,
        totalPrice:            Math.round(lineTotal * 100) / 100,
        dishStatus:            i.dishStatus,
        servingGroupId:        i.servingGroupId,
        comment:               i.comment,
        excludedIngredients:   i.excludedIngredients   || [],
        addons:                i.addons                || [],
        componentGroupChoices: i.componentGroupChoices || [],
      };
    });

    const totalAmount = items.reduce((s, i) => s + i.totalPrice, 0);

    respond(res, req, {
      order: {
        _id:          order._id,
        publicId:     order._id,   // _id IS the public ID
        status:       order.status,
        paymentMethod: order.paymentMethod ?? null,
        tableId:      String(order.tableId),
        tableNumber:  table?.number ?? null,
        restaurantId:     String(order.restaurantId),
        restaurantName:   restaurant?.name || '',
        restaurantName_en: restaurant?.translations?.en?.name?.value || restaurant?.name || '',
        restaurantPlan:   restaurant?.plan || 'free',
        totalAmount:  Math.round(totalAmount * 100) / 100,
        createdAt:    order.createdAt,
        userId:       orderUser
          ? { _id: orderUser._id, name: orderUser.name, email: orderUser.email, role: orderUser.role }
          : null,
      },
      servingGroups: groups,
      items,
    });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/guest-items — guest adds more dishes to an existing order
router.post('/:orderId/guest-items', async (req, res, next) => {
  try {
    const { sessionToken, items } = req.body;
    if (!sessionToken || !items?.length) {
      return next(badRequest('sessionToken and items are required'));
    }

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    if (order.sessionToken !== sessionToken) {
      return next(sessionMismatch());
    }

    if (['cancelled', 'completed_cash', 'completed_epay', 'open_paid'].includes(order.status)) {
      return next(orderFinalized());
    }

    // ── Menu change validation ─────────────────────────────────────────────
    const menuChanges = await validateCartItems(items, req.restaurantId);
    if (menuChanges.length > 0) {
      return res.status(409).json({
        error: {
          code:     'MENU_CHANGED',
          message:  'Menu has changed since your cart was loaded',
          blocking: menuChanges.some(c => c.blocking),
          changes:  menuChanges,
        },
        meta: { request_id: req.requestId },
      });
    }

    const existingGroupCount = await ServingGroup.countDocuments({ orderId: order._id });
    const newGroup = await ServingGroup.create({
      orderId:   order._id,
      name:      `Додаткова подача ${existingGroupCount}`,
      sortOrder: existingGroupCount,
    });

    const table = await Table.findById(order.tableId).select('number').lean();

    const orderItems = [];
    for (const it of items) {
      const menuItem = await MenuItem.findOne({ _id: it.menuItemId, restaurantId: req.restaurantId, isAvailable: true, isDeleted: false });
      if (!menuItem) return next(badRequest(`Menu item ${it.menuItemId} not found or unavailable`));

      const oi = await OrderItem.create({
        orderId:        order._id,
        servingGroupId: newGroup._id,
        menuItemId:     it.menuItemId,
        menuItemName:   menuItem.name,
        quantity:       it.qty || 1,
        unitPrice:      menuItem.basePrice,
        comment:        it.comment,
      });
      orderItems.push(oi);
    }

    await recalcOrderStatus(order._id);

    const leanItemsAdded = orderItems.map(oi => oi.toObject ? oi.toObject() : oi);
    const enrichedAdded  = await enrichOrderItems(leanItemsAdded);
    const formattedItems = enrichedAdded.map(oi => ({
      _id:            oi._id,
      menuItemId:     oi.menuItemId,                                // { _id, name, name_en }
      qty:            oi.quantity,
      totalPrice:     Math.round(oi.unitPrice * oi.quantity * 100) / 100,
      dishStatus:     oi.dishStatus,
      servingGroupId: oi.servingGroupId,
      comment:        oi.comment,
    }));

    emit(`kitchen:${req.restaurantId}`, 'ORDER_ITEMS_ADDED', {
      orderId:     order._id,
      tableNumber: table?.number,
      newGroup:    { id: newGroup._id, name: newGroup.name },
      items:       formattedItems,
    });
    emit(`waiter:${req.restaurantId}`, 'ORDER_ITEMS_ADDED', {
      orderId:     order._id,
      tableNumber: table?.number,
    });

    await createNotification({
      orderId: order._id, restaurantId: req.restaurantId,
      sessionToken: order.sessionToken, tableId: order.tableId, type: 'items_added',
      data: { count: orderItems.length },
    });

    respond(res, req, {
      newGroup: { _id: newGroup._id, name: newGroup.name },
      items:    formattedItems,
    });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/items — add items (waiter/admin)
router.post('/:orderId/items', requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));
    if (['cancelled', 'completed_cash', 'completed_epay', 'open_paid'].includes(order.status)) return next(orderFinalized());

    const groups = await ServingGroup.find({ orderId: order._id }).lean();
    const maxSortOrder = groups.reduce((m, g) => Math.max(m, g.sortOrder ?? 0), -1);
    const groupName = (typeof req.body.groupName === 'string' && req.body.groupName.trim())
      ? req.body.groupName.trim()
      : 'Added by staff';
    const waiterGroup = await ServingGroup.create({
      orderId:   order._id,
      name:      groupName,
      sortOrder: maxSortOrder + 1,
    });

    const newItems = [];
    for (const it of req.body.items || []) {
      const menuItem = await MenuItem.findOne({ _id: it.menuItemId, restaurantId: req.restaurantId, isAvailable: true, isDeleted: false });
      if (!menuItem) continue;

      // Snapshot addons
      const addonsData = [];
      if (it.addons?.length) {
        for (const a of it.addons) {
          const embedded = menuItem.addons?.find(x => x._id.toString() === String(a.addOnId));
          if (embedded && embedded.isAvailable !== false) {
            addonsData.push({ _id: embedded._id, name: embedded.name, price: embedded.price, quantity: a.quantity || 1 });
          }
        }
      }

      // Snapshot excluded ingredients
      const excludedData = [];
      if (it.excludedIngredients?.length) {
        for (const eId of it.excludedIngredients) {
          const ing = menuItem.ingredients?.find(x => x._id.toString() === String(eId));
          if (ing && ing.isRemovable) excludedData.push({ _id: ing._id, name: ing.name });
        }
      }

      // Snapshot component group choices
      const cgChoicesData = [];
      if (it.componentGroupChoices?.length) {
        for (const choice of it.componentGroupChoices) {
          const cg = menuItem.componentGroups?.find(x => x._id.toString() === String(choice.groupId));
          if (!cg) continue;
          const opt = cg.options?.find(x => x._id.toString() === String(choice.optionId));
          if (!opt) continue;
          cgChoicesData.push({ groupId: cg._id, groupName: cg.name, optionId: opt._id, optionName: opt.name, priceModifier: opt.priceModifier || 0 });
        }
      }

      const addonTotal = addonsData.reduce((s, a) => s + a.price * a.quantity, 0);
      const groupTotal = cgChoicesData.reduce((s, c) => s + c.priceModifier, 0);
      const unitPrice  = menuItem.basePrice + addonTotal + groupTotal;

      const oi = await OrderItem.create({
        orderId:               order._id,
        servingGroupId:        waiterGroup._id,
        menuItemId:            it.menuItemId,
        menuItemName:          menuItem.name,
        quantity:              it.qty || 1,
        unitPrice,
        comment:               it.comment,
        excludedIngredients:   excludedData,
        addons:                addonsData,
        componentGroupChoices: cgChoicesData,
      });
      newItems.push(oi);
    }

    if (newItems.length) {
      try {
        await createNotification({
          orderId: order._id, restaurantId: req.restaurantId,
          sessionToken: order.sessionToken, tableId: order.tableId, type: 'items_added',
          data: { count: newItems.length },
        });
      } catch (e) { console.error('waiter items: createNotification failed', e?.message); }
    }

    await recalcOrderStatus(order._id);

    emit(`session:${order.sessionToken}`, 'ORDER_ITEMS_ADDED', { orderId: order._id, tableId: order.tableId });
    emit(`table:${order.tableId}`,        'ORDER_ITEMS_ADDED', { orderId: order._id, tableId: order.tableId });
    emit(`waiter:${req.restaurantId}`,    'ORDER_ITEMS_ADDED', { orderId: order._id, tableId: order.tableId });
    emit(`kitchen:${req.restaurantId}`,   'ORDER_ITEMS_ADDED', { orderId: order._id, tableId: order.tableId });

    respond(res, req, { items: newItems });
  } catch (err) { next(err); }
});

// PATCH /:restaurantId/orders/:orderId/items/:itemId
router.patch('/:orderId/items/:itemId', requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, async (req, res, next) => {
  try {
    const item = await OrderItem.findOne({ _id: req.params.itemId, orderId: req.params.orderId });
    if (!item) return next(notFound('Order item not found'));
    if (item.dishStatus !== 'waiting' && !['admin', 'root_admin'].includes(req.user.role)) return next(itemNotEditable());

    const { qty, comment, excludedIngredients, addons, componentGroupChoices } = req.body;
    if (qty     !== undefined) item.quantity = qty;
    if (comment !== undefined) item.comment  = comment;

    const hasModifiers = excludedIngredients !== undefined || addons !== undefined || componentGroupChoices !== undefined;
    if (hasModifiers) {
      const menuItem = await MenuItem.findOne({ _id: item.menuItemId, restaurantId: req.restaurantId });
      if (!menuItem) return next(notFound('Menu item not found'));

      if (excludedIngredients !== undefined) {
        const excluded = [];
        for (const eid of excludedIngredients) {
          const ing = (menuItem.ingredients || []).find(x => x._id.toString() === String(eid));
          if (ing && ing.isRemovable) excluded.push({ _id: ing._id, name: ing.name });
        }
        item.excludedIngredients = excluded;
      }

      if (addons !== undefined) {
        const addonsData = [];
        for (const a of addons) {
          const embedded = (menuItem.addons || []).find(x => x._id.toString() === String(a.addOnId));
          if (embedded && embedded.isAvailable !== false) {
            addonsData.push({ _id: embedded._id, name: embedded.name, price: embedded.price, quantity: a.quantity || 1 });
          }
        }
        item.addons = addonsData;
      }

      if (componentGroupChoices !== undefined) {
        const cgData = [];
        for (const choice of componentGroupChoices) {
          const cg  = (menuItem.componentGroups || []).find(x => x._id.toString() === String(choice.groupId));
          if (!cg) continue;
          const opt = (cg.options || []).find(x => x._id.toString() === String(choice.optionId));
          if (!opt) continue;
          cgData.push({ groupId: cg._id, groupName: cg.name, optionId: opt._id, optionName: opt.name, priceModifier: opt.priceModifier || 0 });
        }
        item.componentGroupChoices = cgData;
      }

      item.unitPrice = menuItem.basePrice;
    }

    await item.save();
    await recalcOrderStatus(req.params.orderId);

    const order = await Order.findById(req.params.orderId).lean();
    if (order) {
      emit(`waiter:${req.restaurantId}`,  'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
      emit(`kitchen:${req.restaurantId}`, 'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
      emit(`table:${order.tableId}`,      'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
    }

    respond(res, req, item);
  } catch (err) { next(err); }
});

// DELETE /:restaurantId/orders/:orderId/items/:itemId
router.delete('/:orderId/items/:itemId', requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, async (req, res, next) => {
  try {
    const item = await OrderItem.findOne({ _id: req.params.itemId, orderId: req.params.orderId });
    if (!item) return next(notFound('Order item not found'));
    if (item.dishStatus !== 'waiting' && !['admin', 'root_admin'].includes(req.user.role)) return next(itemNotEditable());

    const orderId = req.params.orderId;
    await item.deleteOne();
    await recalcOrderStatus(orderId);

    const order = await Order.findById(orderId).lean();
    if (order) {
      emit(`waiter:${req.restaurantId}`,  'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
      emit(`kitchen:${req.restaurantId}`, 'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
      emit(`table:${order.tableId}`,      'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
    }

    await maybeFinalizeOpenPaidOrder(orderId);

    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/client-cancel — guest cancels whole order (waiting items only)
router.post('/:orderId/client-cancel', async (req, res, next) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) return next(badRequest('sessionToken is required'));

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    if (order.sessionToken !== sessionToken) {
      return next(sessionMismatch());
    }

    if (['cancelled', 'completed_cash', 'completed_epay', 'open_paid'].includes(order.status)) {
      return next(orderFinalized());
    }

    const items = await OrderItem.find({ orderId: order._id });
    const allWaiting = items.every(i => i.dishStatus === 'waiting');
    if (!allWaiting) {
      return next(orderItemsBeingPrepared());
    }

    order.status = 'cancelled';
    order.cancelReason = 'Cancelled by guest';
    await order.save();

    await recalcTableStatus(order.tableId);

    emit(`session:${order.sessionToken}`, 'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
    emit(`table:${order.tableId}`,        'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
    emit(`kitchen:${req.restaurantId}`,   'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
    emit(`waiter:${req.restaurantId}`,    'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });

    respond(res, req, { orderId: order._id, status: 'cancelled' });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/serving-groups/:groupId/client-cancel — guest cancels one waiting group
router.post('/:orderId/serving-groups/:groupId/client-cancel', async (req, res, next) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) return next(badRequest('sessionToken is required'));

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    if (order.sessionToken !== sessionToken) {
      return next(sessionMismatch());
    }

    if (['cancelled', 'completed_cash', 'completed_epay', 'open_paid'].includes(order.status)) {
      return next(orderFinalized());
    }

    const group = await ServingGroup.findOne({ _id: req.params.groupId, orderId: order._id });
    if (!group) return next(notFound('Serving group not found'));

    const groupItems = await OrderItem.find({ servingGroupId: group._id, orderId: order._id });
    const allWaiting = groupItems.every(i => i.dishStatus === 'waiting');
    if (!allWaiting) {
      return next(orderItemsBeingPrepared('Cannot cancel — some items in this group are already being prepared'));
    }

    await OrderItem.deleteMany({ servingGroupId: group._id, orderId: order._id });
    await group.deleteOne();

    // If no items remain, void the whole order
    const remaining = await OrderItem.countDocuments({ orderId: order._id });
    if (remaining === 0) {
      order.status = 'cancelled';
      order.cancelReason = 'All groups cancelled by guest';
      await order.save();
      await recalcTableStatus(order.tableId);
      emit(`session:${order.sessionToken}`, 'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
      emit(`kitchen:${req.restaurantId}`,   'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
      emit(`waiter:${req.restaurantId}`,    'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
    } else {
      await recalcOrderStatus(order._id);
      emit(`kitchen:${req.restaurantId}`, 'GROUP_CANCELLED', { orderId: order._id, groupId: group._id });
      emit(`waiter:${req.restaurantId}`,  'GROUP_CANCELLED', { orderId: order._id, groupId: group._id });
    }

    respond(res, req, { groupId: group._id, deleted: true });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/items/:itemId/client-cancel — guest cancels one waiting item
router.post('/:orderId/items/:itemId/client-cancel', async (req, res, next) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) return next(badRequest('sessionToken is required'));

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    if (order.sessionToken !== sessionToken) return next(sessionMismatch());

    if (['cancelled', 'completed_cash', 'completed_epay', 'open_paid'].includes(order.status)) {
      return next(orderFinalized());
    }

    const item = await OrderItem.findOne({ _id: req.params.itemId, orderId: order._id });
    if (!item) return next(notFound('Order item not found'));

    if (item.dishStatus !== 'waiting') {
      return next(createError(409, 'ITEM_NOT_CANCELLABLE', 'Only waiting items can be cancelled by the guest'));
    }

    await item.deleteOne();

    // If no items remain, void the whole order
    const remaining = await OrderItem.countDocuments({ orderId: order._id });
    if (remaining === 0) {
      order.status = 'cancelled';
      order.cancelReason = 'All items cancelled by guest';
      await order.save();
      await recalcTableStatus(order.tableId);
      emit(`session:${order.sessionToken}`, 'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
      emit(`table:${order.tableId}`,        'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
      emit(`kitchen:${req.restaurantId}`,   'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
      emit(`waiter:${req.restaurantId}`,    'ORDER_CANCELLED', { orderId: order._id, cancelledAt: new Date() });
    } else {
      emit(`kitchen:${req.restaurantId}`, 'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
      emit(`waiter:${req.restaurantId}`,  'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
      emit(`table:${order.tableId}`,      'ORDER_UPDATED', { orderId: order._id, tableId: order.tableId });
    }

    respond(res, req, { itemId: item._id, deleted: true });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/cancel — waiter/admin cancels an order
async function handleCancelOrder(req, res, next) {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));
    if (['cancelled', 'completed_cash', 'completed_epay'].includes(order.status)) return next(orderFinalized());
    if (order.status === 'open_paid') return next(orderPaidCannotCancel());

    // Reason is only required when kitchen has already started preparing dishes.
    // If all items are still 'waiting' (order just created), allow free cancellation.
    const items = await OrderItem.find({ orderId: order._id }).select('dishStatus').lean();
    const allWaiting = items.length === 0 || items.every(i => i.dishStatus === 'waiting');
    if (!allWaiting && (!reason || reason.trim().length < 10)) {
      return next(createError(400, 'CANCEL_REASON_TOO_SHORT', 'Cancel reason must be at least 10 characters'));
    }

    const finalReason = reason?.trim() || 'Cancelled by staff';
    order.status = 'cancelled';
    order.cancelReason = finalReason;
    await order.save();

    // Secondary operations must not prevent the success response — wrap each individually.
    try {
      await auditService.log({
        restaurantId: req.restaurantId,
        eventType: 'CANCEL',
        orderId: order._id,
        tableId: order.tableId,
        initiatedBy: { userId: req.user._id, role: req.user.role },
        reason: finalReason,
        meta: { sessionToken: order.sessionToken, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      });
    } catch (e) { console.error('handleCancelOrder: auditService.log failed', e?.message); }

    try { await recalcTableStatus(order.tableId); }
    catch (e) { console.error('handleCancelOrder: recalcTableStatus failed', e?.message); }

    emit(`session:${order.sessionToken}`, 'ORDER_CANCELLED', { orderId: order._id, reason: finalReason, cancelledBy: req.user._id, cancelledAt: new Date() });
    emit(`table:${order.tableId}`,        'ORDER_CANCELLED', { orderId: order._id, reason: finalReason, cancelledAt: new Date() });
    emit(`kitchen:${req.restaurantId}`,   'ORDER_CANCELLED', { orderId: order._id, reason: finalReason, cancelledAt: new Date() });
    emit(`waiter:${req.restaurantId}`,    'ORDER_CANCELLED', { orderId: order._id, reason: finalReason, cancelledAt: new Date() });

    try {
      await createNotification({ orderId: order._id, restaurantId: req.restaurantId, sessionToken: order.sessionToken, tableId: order.tableId, type: 'order_cancelled', data: { reason: finalReason } });
    } catch (e) { console.error('handleCancelOrder: createNotification failed', e?.message); }

    respond(res, req, { orderId: order._id, status: 'cancelled', reason: finalReason });
  } catch (err) { next(err); }
}

router.post('/:orderId/cancel', requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, handleCancelOrder);
// Keep /void as an alias for backwards compatibility
router.post('/:orderId/void',   requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, handleCancelOrder);

// POST /:restaurantId/orders/:orderId/close — waiter manually closes an order (cash or pre-paid completion)
router.post('/:orderId/close', requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));
    if (['cancelled', 'completed_cash', 'completed_epay'].includes(order.status)) return next(orderFinalized());
    if (!['open', 'open_paid'].includes(order.status)) {
      return next(createError(400, 'Order cannot be closed in its current state'));
    }

    // open_paid = already paid electronically → complete with original payment method
    // open = waiter closes manually → treat as cash
    const wasUnpaid = order.status === 'open';
    const newStatus = order.status === 'open_paid'
      ? (order.paymentMethod === 'epay' ? 'completed_epay' : 'completed_cash')
      : 'completed_cash';

    order.status = newStatus;
    await order.save();

    try { await recalcTableStatus(order.tableId); } catch (e) { console.error('close: recalcTableStatus failed', e?.message); }

    emit(`session:${order.sessionToken}`, 'ORDER_COMPLETED', { orderId: order._id, status: newStatus });
    emit(`table:${order.tableId}`,        'ORDER_COMPLETED', { orderId: order._id, status: newStatus });
    emit(`kitchen:${req.restaurantId}`,   'ORDER_COMPLETED', { orderId: order._id, status: newStatus });
    emit(`waiter:${req.restaurantId}`,    'ORDER_COMPLETED', { orderId: order._id, status: newStatus });

    // Only the manual close of an as-yet-unpaid order is a payment event; an
    // already-paid (open_paid) order had its receipt logged when it was paid.
    if (wasUnpaid) {
      try {
        const items   = await OrderItem.find({ orderId: order._id }).lean();
        const receipt = auditService.buildReceipt(items);
        await auditService.log({
          restaurantId: req.restaurantId,
          eventType: 'CASH_PAYMENT',
          orderId: order._id,
          tableId: order.tableId,
          initiatedBy: { userId: req.user._id, role: req.user.role },
          amount: receipt.total,
          paymentMethod: 'CASH',
          reason: 'Manual close by staff',
          receipt,
          meta: { sessionToken: order.sessionToken, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
        });
      } catch (e) { console.error('close: auditService.log failed', e?.message); }
    }

    respond(res, req, { orderId: order._id, status: newStatus });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/waiter-call — guest or authenticated order owner
router.post('/:orderId/waiter-call', optionalAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];
    const isOwner      = sessionToken && order.sessionToken === sessionToken;
    const isAuthOwner  = req.user && order.userId?.toString() === req.user._id.toString();
    if (!isOwner && !isAuthOwner) return next(sessionMismatch());

    const activeCall = await WaiterCall.findOne({ tableId: order.tableId, status: 'active' });
    if (activeCall) {
      return res.status(409).json({ error: { code: 'ACTIVE_CALL_EXISTS', message: 'There is already an active waiter call for this table' }, meta: { request_id: req.requestId } });
    }

    const table = await Table.findById(order.tableId);
    const call = await WaiterCall.create({
      tableId: order.tableId,
      restaurantId: req.restaurantId,
      orderId: order._id,
      sessionToken: order.sessionToken, // always use the order's own token for WS routing
      type: 'call',
    });

    emit(`waiter:${req.restaurantId}`, 'WAITER_CALL', {
      callId: call._id,
      tableId: order.tableId,
      tableNumber: table?.number,
      orderId: order._id,
      type: 'call',
      createdAt: call.createdAt,
    });

    respond(res, req, { callId: call._id });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/waiter-call-cash — guest or authenticated order owner
// Immediately marks the order as paid (open_paid) and notifies the waiter.
router.post('/:orderId/waiter-call-cash', optionalAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    if (['open_paid', 'completed_cash', 'completed_epay', 'cancelled'].includes(order.status)) {
      return res.status(409).json({ error: { code: 'PAYMENT_ALREADY_MADE', message: 'Payment has already been processed for this order' }, meta: { request_id: req.requestId } });
    }

    const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];
    const isOwner     = sessionToken && order.sessionToken === sessionToken;
    const isAuthOwner = req.user && order.userId?.toString() === req.user._id.toString();
    if (!isOwner && !isAuthOwner) return next(sessionMismatch());

    const table = await Table.findById(order.tableId);

    // ── 1. Create waiter call so the waiter panel shows the notification ──
    const call = await WaiterCall.create({
      tableId: order.tableId,
      restaurantId: req.restaurantId,
      orderId: order._id,
      sessionToken: order.sessionToken,
      type: 'cash_payment',
    });

    // ── 2. Mark order paid immediately ───────────────────────────────────
    const totalAmount   = order.totalAmount ?? 0;
    order.status        = 'open_paid';
    order.paymentMethod = 'cash';
    await order.save();

    await Payment.create({
      orderId:      order._id,
      restaurantId: req.restaurantId,
      amount:       totalAmount,
      method:       'cash',
      status:       'completed',
    });

    // ── 3. Notify client via WS ───────────────────────────────────────────
    emit(`session:${order.sessionToken}`, 'PAYMENT_COMPLETED', { orderId: order._id, method: 'cash', amount: totalAmount });
    emit(`table:${order.tableId}`,        'PAYMENT_COMPLETED', { orderId: order._id, method: 'cash', amount: totalAmount });
    emit(`kitchen:${req.restaurantId}`,   'PAYMENT_COMPLETED', { orderId: order._id, method: 'cash', amount: totalAmount });

    // ── 4. Alert waiter panel ─────────────────────────────────────────────
    emit(`waiter:${req.restaurantId}`, 'WAITER_CALL_CASH', {
      callId: call._id,
      tableId: order.tableId,
      tableNumber: table?.number,
      orderId: order._id,
      type: 'cash_payment',
      createdAt: call.createdAt,
    });

    // ── 5. Push in-app notification to client ─────────────────────────────
    try {
      await createNotification({
        orderId:      order._id,
        restaurantId: req.restaurantId,
        sessionToken: order.sessionToken,
        tableId:      order.tableId,
        type:         'payment_completed_cash',
        data:         { amount: totalAmount },
      });
    } catch (e) { console.error('waiter-call-cash: createNotification failed', e?.message); }

    // ── 6. Finalize if all dishes already served ──────────────────────────
    try { await maybeFinalizeOpenPaidOrder(order._id); }
    catch (e) { console.error('waiter-call-cash: maybeFinalizeOpenPaidOrder failed', e?.message); }

    respond(res, req, { callId: call._id });
  } catch (err) { next(err); }
});

// POST /:restaurantId/orders/:orderId/revert-payment — waiter/admin only
// Reverts a cash-paid order (open_paid or completed_cash) back to open.
// open_paid  = payment received, dishes still being served
// completed_cash = payment received AND all dishes were already served —
//   maybeFinalizeOpenPaidOrder jumps straight here, so revert must handle it too.
router.post('/:orderId/revert-payment', requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    const revertableStatuses = ['open_paid', 'completed_cash'];
    if (!revertableStatuses.includes(order.status)) {
      return res.status(409).json({ error: { code: 'ORDER_NOT_PAID', message: 'Order is not in a revertable paid status' }, meta: { request_id: req.requestId } });
    }
    if (order.paymentMethod !== 'cash') {
      return res.status(409).json({ error: { code: 'CANNOT_REVERT_EPAY', message: 'Only cash payments can be reverted' }, meta: { request_id: req.requestId } });
    }

    // Revert order to open
    order.status        = 'open';
    order.paymentMethod = undefined;
    await order.save();

    // Mark the most recent cash payment as reverted
    await Payment.findOneAndUpdate(
      { orderId: order._id, method: 'cash', status: 'completed' },
      { status: 'reverted', revertedAt: new Date(), revertedBy: req.user._id },
      { sort: { createdAt: -1 } }
    );

    // Resolve any active cash_payment waiter calls so the waiter panel clears
    await WaiterCall.updateMany(
      { orderId: order._id, type: 'cash_payment', status: 'active' },
      { status: 'resolved', resolvedAt: new Date(), resolvedBy: req.user._id }
    );

    // Recalc table status — if the order was completed_cash the table was freed;
    // reverting back to open must re-occupy it.
    try { await recalcTableStatus(order.tableId); }
    catch (e) { console.error('revert-payment: recalcTableStatus failed', e?.message); }

    // Notify the client that the order is open again
    emit(`session:${order.sessionToken}`, 'ORDER_UPDATED', { orderId: order._id, status: 'open' });
    emit(`table:${order.tableId}`,        'ORDER_UPDATED', { orderId: order._id, status: 'open' });
    emit(`waiter:${req.restaurantId}`,    'ORDER_UPDATED', { orderId: order._id, status: 'open' });

    respond(res, req, { orderId: order._id, status: 'open' });
  } catch (err) { next(err); }
});

// PATCH /:restaurantId/orders/:orderId/groups/:groupId/status
router.patch('/:orderId/groups/:groupId/status', requireAuth, requireRole('waiter', 'cook', 'waiter_cook', 'admin'), requireSameRestaurant, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['cooking', 'ready', 'served'].includes(status)) return next(invalidDishStatus(['cooking', 'ready', 'served']));

    const group = await ServingGroup.findOne({ _id: req.params.groupId, orderId: req.params.orderId });
    if (!group) return next(notFound('Serving group not found'));

    const statusLevel = { waiting: 0, cooking: 1, ready: 2, served: 3 };
    await OrderItem.updateMany(
      { servingGroupId: group._id, $expr: { $lt: [{ $indexOfArray: [['waiting', 'cooking', 'ready', 'served'], '$dishStatus'] }, statusLevel[status]] } },
      { dishStatus: status }
    );

    const order = await Order.findById(req.params.orderId);
    emit(`session:${order.sessionToken}`, 'GROUP_STATUS_UPDATED', { orderId: order._id, groupId: group._id, groupName: group.name, status, tableId: order.tableId });
    emit(`table:${order.tableId}`,        'GROUP_STATUS_UPDATED', { orderId: order._id, groupId: group._id, groupName: group.name, status });
    emit(`kitchen:${req.restaurantId}`,   'GROUP_STATUS_UPDATED', { orderId: order._id, groupId: group._id, groupName: group.name, status });

    await createNotification({ orderId: order._id, restaurantId: req.restaurantId, sessionToken: order.sessionToken, tableId: order.tableId, type: 'dish_status_updated', data: { dishStatus: status, groupName: group.name } });

    await recalcOrderStatus(order._id);
    respond(res, req, { groupId: group._id, status });
  } catch (err) { next(err); }
});

module.exports = router;
