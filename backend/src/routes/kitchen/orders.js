const router = require('express').Router({ mergeParams: true });
const Order        = require('../../models/Order');
const OrderItem    = require('../../models/OrderItem');
const ServingGroup = require('../../models/ServingGroup');
const Table        = require('../../models/Table');
const Category     = require('../../models/Category');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { emit } = require('../../services/wsService');
const { recalcOrderStatus, maybeFinalizeOpenPaidOrder } = require('../../services/orderService');
const { createNotification } = require('../../services/notificationService');
const { notFound, badRequest, invalidDishStatus, createError } = require('../../middleware/validate');
const { enrichOrderItems } = require('../../services/i18nOrderEnricher');

const kitchenAuth  = [requireAuth, requireRole('cook', 'waiter_cook', 'admin'), requireSameRestaurant];
const serveAuth    = [requireAuth, requireRole('cook', 'waiter_cook', 'admin', 'waiter'), requireSameRestaurant];

function paginate(q) {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

router.get('/', ...kitchenAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const view = req.query.view || 'order';

    const filter = { restaurantId: req.restaurantId, status: { $in: ['open', 'open_paid'] } };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    const orderIds  = orders.map((o) => o._id);
    const rawItems  = await OrderItem.find({ orderId: { $in: orderIds } }).lean();

    // Enrich each OrderItem with `name_en` for the dish + every nested
    // snapshot (ingredients/addons/component groups + options). Replicates
    // the /staff/map join pattern so the frontend can switch language
    // without re-fetching.
    const enriched  = await enrichOrderItems(rawItems);

    const catIds = [...new Set(enriched.map(i => i.menuItemId?.categoryId?.toString()).filter(Boolean))];
    const cats   = catIds.length ? await Category.find({ _id: { $in: catIds } }).select('name translations color').lean() : [];
    const catMap = Object.fromEntries(cats.map(c => [c._id.toString(), c]));
    const items  = enriched.map(i => {
      const cat = i.menuItemId?.categoryId ? catMap[i.menuItemId.categoryId.toString()] : null;
      return {
        ...i,
        categoryName:    cat?.name ?? null,
        categoryName_en: cat?.translations?.en?.name?.value || cat?.name || null,
        categoryColor:   cat?.color ?? null,
      };
    });

    const groups    = await ServingGroup.find({ orderId: { $in: orderIds } }).lean();
    const tableIds  = [...new Set(orders.map((o) => o.tableId.toString()))];
    const tables    = await Table.find({ _id: { $in: tableIds } }).lean();
    const tableMap  = Object.fromEntries(tables.map((t) => [t._id.toString(), t]));

    if (view === 'table') {
      const byTable = {};
      for (const order of orders) {
        const tid = order.tableId.toString();
        if (!byTable[tid]) byTable[tid] = { table: tableMap[tid], orders: [] };
        byTable[tid].orders.push({
          ...order,
          items:         items.filter((i) => i.orderId.toString() === order._id.toString()),
          servingGroups: groups.filter((g) => g.orderId.toString() === order._id.toString()),
        });
      }
      return res.json({ data: Object.values(byTable), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
    }

    const merged = orders.map((o) => ({
      ...o,
      paid:          o.status === 'open_paid',
      table:         tableMap[o.tableId.toString()],
      items:         items.filter((i) => i.orderId.toString() === o._id.toString()),
      servingGroups: groups.filter((g) => g.orderId.toString() === o._id.toString()),
    }));

    res.json({ data: merged, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

const LEVEL = { waiting: 0, cooking: 1, ready: 2, served: 3 };
const STATUS_KEYS = ['waiting', 'cooking', 'ready', 'served'];
const ROLLBACK_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

function minGroupStatus(items) {
  if (!items.length) return 'waiting';
  const min = Math.min(...items.map(i => LEVEL[i.dishStatus] ?? 0));
  return STATUS_KEYS[min] ?? 'waiting';
}

// Update all items in a serving group at once (forward or backward)
router.patch('/:orderId/groups/:groupId/status', ...serveAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUS_KEYS.includes(status)) return next(invalidDishStatus(STATUS_KEYS));

    if (req.user.role === 'waiter' && status !== 'served') {
      return next(createError(403, 'FORBIDDEN', 'Waiters may only mark dishes as served'));
    }

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    const group = await ServingGroup.findOne({ _id: req.params.groupId, orderId: order._id });
    if (!group) return next(notFound('Serving group not found'));

    const items = await OrderItem.find({ orderId: order._id, servingGroupId: group._id });
    if (!items.length) return next(notFound('No items in serving group'));

    const currentStatus = minGroupStatus(items);
    const targetLevel   = LEVEL[status] ?? 0;
    const currentLevel  = LEVEL[currentStatus] ?? 0;
    const isForward     = targetLevel > currentLevel;
    const isBackward    = targetLevel < currentLevel;

    if (isBackward) {
      // Only one step back at a time
      if (currentLevel - targetLevel > 1) {
        return next(createError(400, 'STATUS_ROLLBACK_TOO_FAR', 'Status can only be reverted one step at a time'));
      }
      // Can only rollback within the 2-minute correction window
      const changedAt = group.statusChangedAt ? new Date(group.statusChangedAt).getTime() : 0;
      if (!changedAt || Date.now() - changedAt > ROLLBACK_WINDOW_MS) {
        return next(createError(400, 'ROLLBACK_WINDOW_EXPIRED', 'The 2-minute correction window has expired'));
      }
      // Cannot rollback consecutively — must advance the group first
      if (group.wasRolledBack) {
        return next(createError(400, 'ROLLBACK_ALREADY_USED', 'This group has already been rolled back once — advance it first'));
      }
    }

    // For forward moves: every preceding group must already be at or above the target status
    if (isForward) {
      const allGroups = await ServingGroup.find({ orderId: order._id }).sort({ sortOrder: 1 }).lean();
      const idx = allGroups.findIndex(g => g._id.toString() === group._id.toString());
      if (idx > 0) {
        for (const pg of allGroups.slice(0, idx)) {
          const pgItems = await OrderItem.find({ orderId: order._id, servingGroupId: pg._id }).lean();
          if (!pgItems.length) continue;
          if ((LEVEL[minGroupStatus(pgItems)] ?? 0) < (LEVEL[status] ?? 0)) {
            return next(createError(400, 'PRECEDING_GROUP_NOT_READY', 'A preceding serving group has not yet reached this status'));
          }
        }
      }
    }

    // Apply new status to every item in the group
    for (const item of items) {
      item.dishStatus = status;
      await item.save();
    }

    // Stamp the group; track rollback state
    group.statusChangedAt = new Date();
    group.wasRolledBack   = isBackward ? true : false;
    await group.save();

    for (const item of items) {
      emit(`session:${order.sessionToken}`, 'DISH_STATUS_UPDATED', { orderId: order._id, orderItemId: item._id, dishStatus: status, groupId: group._id });
      emit(`table:${order.tableId}`,        'DISH_STATUS_UPDATED', { orderId: order._id, orderItemId: item._id, dishStatus: status, groupId: group._id });
      emit(`waiter:${req.restaurantId}`,    'DISH_STATUS_UPDATED', { orderId: order._id, orderItemId: item._id, dishStatus: status, groupId: group._id });
    }

    if (isBackward) {
      await createNotification({ orderId: order._id, restaurantId: req.restaurantId, sessionToken: order.sessionToken, tableId: order.tableId, type: 'dish_status_corrected', data: { fromStatus: currentStatus, toStatus: status, groupName: group.name } });
    } else {
      await createNotification({ orderId: order._id, restaurantId: req.restaurantId, sessionToken: order.sessionToken, tableId: order.tableId, type: 'dish_status_updated', data: { dishStatus: status, groupName: group.name } });
    }

    await recalcOrderStatus(order._id);
    // If the order was prepaid (open_paid) and this last update finishes all
    // dishes, auto-finalize the order and free the table.
    if (status === 'served') await maybeFinalizeOpenPaidOrder(order._id);
    res.json({ data: { groupId: group._id, dishStatus: status, updatedItems: items.length, wasRolledBack: group.wasRolledBack }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// Update a single item status (kept for backwards compatibility)
router.patch('/:orderId/items/:itemId/status', ...serveAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID = ['cooking', 'ready', 'served'];
    if (!VALID.includes(status)) return next(invalidDishStatus(VALID));

    if (req.user.role === 'waiter' && status !== 'served') {
      return next(createError(403, 'FORBIDDEN', 'Waiters may only mark dishes as served'));
    }

    const item = await OrderItem.findOne({ _id: req.params.itemId, orderId: req.params.orderId });
    if (!item) return next(notFound('Order item not found'));

    const levelMap = { waiting: 0, cooking: 1, ready: 2, served: 3 };
    if (levelMap[status] <= levelMap[item.dishStatus]) {
      return next(createError(400, 'STATUS_CANNOT_DECREASE', 'Status can only be increased'));
    }

    item.dishStatus = status;
    await item.save();

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    emit(`session:${order.sessionToken}`,  'DISH_STATUS_UPDATED', { orderId: order._id, orderItemId: item._id, dishStatus: status, groupId: item.servingGroupId });
    emit(`table:${order.tableId}`,         'DISH_STATUS_UPDATED', { orderId: order._id, orderItemId: item._id, dishStatus: status, groupId: item.servingGroupId });
    emit(`waiter:${req.restaurantId}`,     'DISH_STATUS_UPDATED', { orderId: order._id, orderItemId: item._id, dishStatus: status, groupId: item.servingGroupId });

    await recalcOrderStatus(order._id);
    if (status === 'served') await maybeFinalizeOpenPaidOrder(order._id);
    res.json({ data: { orderItemId: item._id, dishStatus: status }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
