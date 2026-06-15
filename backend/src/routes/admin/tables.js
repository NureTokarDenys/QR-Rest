const router = require('express').Router({ mergeParams: true });
const Table      = require('../../models/Table');
const Order      = require('../../models/Order');
const OrderItem  = require('../../models/OrderItem');
const MenuItem   = require('../../models/MenuItem');
const WaiterCall = require('../../models/WaiterCall');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound, badRequest } = require('../../middleware/validate');
const { invalidateTableSessions } = require('../../services/sessionService');
const { emit } = require('../../services/wsService');
const QRCode = require('qrcode');

const adminAuth  = [requireAuth, requireRole('admin'), requireSameRestaurant];
// Waiter + admin both need the table map
const staffAuth  = [requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant];

function paginate(q) {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// GET /:restaurantId/admin/tables
// Used by Table Map (waiter + admin). Returns every table with an embedded
// currentOrder snapshot (single active order) so the UI can show dish names.
router.get('/', ...staffAuth, async (req, res, next) => {
  try {
    const filter = { restaurantId: req.restaurantId };
    if (req.query.status) filter.status = req.query.status;

    const tables = await Table.find(filter).lean();

    // Active orders for this restaurant
    const activeOrders = await Order.find({
      restaurantId: req.restaurantId,
      status: { $nin: ['cancelled', 'completed_cash', 'completed_epay'] },
    }).lean();

    // Fetch items for all active orders (lean, no populate — we do the join manually
    // using raw ObjectId instances so the driver never needs to cast strings → ObjectId)
    const orderIds = activeOrders.map((o) => o._id);
    const allItems = orderIds.length
      ? await OrderItem.find({ orderId: { $in: orderIds } }).lean()
      : [];

    const rawMenuItemIds = allItems.map((i) => i.menuItemId); // ObjectId objects
    const menuItems = rawMenuItemIds.length
      ? await MenuItem.find({ _id: { $in: rawMenuItemIds } }).select('name translations').lean()
      : [];
    const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]));

    // Index active orders by tableId — each table has at most one
    const orderByTable = {};
    for (const o of activeOrders) {
      const key = o.tableId.toString();
      if (!orderByTable[key]) orderByTable[key] = o; // keep first (oldest)
    }

    // Active waiter calls indexed by tableId
    const activeCalls = await WaiterCall.find({ restaurantId: req.restaurantId, status: 'active' }).lean();
    const callByTable = {};
    for (const c of activeCalls) {
      callByTable[c.tableId.toString()] = c;
    }

    const data = tables.map((t) => {
      const order = orderByTable[t._id.toString()] ?? null;

      const currentOrder = order ? {
        _id:   order._id,
        items: allItems
          .filter((i) => i.orderId.toString() === order._id.toString())
          .map((i) => {
            const mi = menuMap.get(i.menuItemId.toString());
            return {
              menuItemId: {
                _id:     i.menuItemId,
                name:    mi?.name ?? '',
                name_en: mi?.translations?.en?.name?.value || mi?.name || '',
              },
              qty:        i.quantity,
              dishStatus: i.dishStatus,
            };
          }),
      } : null;

      return {
        ...t,
        name: t.label || `Стіл ${t.number}`,
        currentOrder,
        activeWaiterCall: callByTable[t._id.toString()] ?? null,
      };
    });

    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/', ...adminAuth, async (req, res, next) => {
  try {
    const { number, label, capacity } = req.body;
    if (!number) return next(badRequest('number is required'));

    // Guard: reject duplicate table numbers within the same restaurant
    const duplicate = await Table.findOne({ restaurantId: req.restaurantId, number: Number(number) });
    if (duplicate) return next(badRequest('TABLE_NUMBER_EXISTS'));

    // Set mapOrder to come after all existing tables
    const count = await Table.countDocuments({ restaurantId: req.restaurantId });
    const table = await Table.create({ number, label, capacity, restaurantId: req.restaurantId, mapOrder: count });
    emit(`restaurant:${req.restaurantId}`, 'TABLE_CREATED', { tableId: table._id });
    res.status(201).json({ data: table, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// PATCH /reorder — batch-update mapOrder for all tables at once
router.patch('/reorder', ...adminAuth, async (req, res, next) => {
  try {
    const { order } = req.body; // [{ id, mapOrder }]
    if (!Array.isArray(order) || order.length === 0) return next(badRequest('order array is required'));
    await Table.bulkWrite(
      order.map(({ id, mapOrder }) => ({
        updateOne: {
          filter: { _id: id, restaurantId: req.restaurantId },
          update: { $set: { mapOrder } },
        },
      }))
    );
    emit(`restaurant:${req.restaurantId}`, 'TABLES_REORDERED', { count: order.length });
    res.json({ data: { updated: order.length }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.get('/:tableId', ...adminAuth, async (req, res, next) => {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId }).lean();
    if (!table) return next(notFound('Table not found'));
    res.json({ data: table, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/:tableId', ...adminAuth, async (req, res, next) => {
  try {
    const { number, label, capacity, isActive, mapOrder } = req.body;
    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId });
    if (!table) return next(notFound('Table not found'));

    // Guard: reject if the requested number is already used by a different table
    if (number !== undefined && Number(number) !== table.number) {
      const duplicate = await Table.findOne({
        restaurantId: req.restaurantId,
        number: Number(number),
        _id: { $ne: table._id },
      });
      if (duplicate) return next(badRequest('TABLE_NUMBER_EXISTS'));
    }

    if (number   !== undefined) table.number   = Number(number);
    if (label    !== undefined) table.label    = label;
    if (capacity !== undefined) table.capacity = capacity;
    if (isActive !== undefined) table.isActive = isActive;
    if (mapOrder !== undefined) table.mapOrder = mapOrder;
    await table.save();
    emit(`restaurant:${req.restaurantId}`, 'TABLE_UPDATED', { tableId: table._id });
    res.json({ data: table, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.delete('/:tableId', ...adminAuth, async (req, res, next) => {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId });
    if (!table) return next(notFound('Table not found'));
    table.status = 'disabled';
    await table.save();
    emit(`restaurant:${req.restaurantId}`, 'TABLE_DELETED', { tableId: table._id });
    res.json({ data: { tableId: table._id, status: 'disabled' }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/admin/tables/:tableId/qr — download QR PNG
router.get('/:tableId/qr', ...adminAuth, async (req, res, next) => {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId }).lean();
    if (!table) return next(notFound('Table not found'));

    // QR encodes the frontend landing route /qr/:shortCode.
    // That page calls initSession → stores session → redirects to /menu.
    const url = `${process.env.BASE_URL}/qr/${table.shortCode}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 300 });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="table-${table.number}.png"`);
    res.send(png);
  } catch (err) { next(err); }
});

module.exports = router;
