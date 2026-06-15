const router = require('express').Router({ mergeParams: true });
const Order     = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const Table     = require('../../models/Table');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');

const staffAuth = [requireAuth, requireRole('cook', 'waiter', 'waiter_cook', 'admin'), requireSameRestaurant];

function paginate(q) {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

router.get('/', ...staffAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { restaurantId: req.restaurantId, status: { $nin: ['cancelled', 'completed_cash', 'completed_epay'] } };
    if (req.query.tableId) filter.tableId = req.query.tableId;
    if (req.query.status)  filter.status  = req.query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    const orderIds = orders.map((o) => o._id);
    const items    = await OrderItem.find({ orderId: { $in: orderIds } }).lean();
    const enriched = orders.map((o) => ({ ...o, items: items.filter((i) => i.orderId.toString() === o._id.toString()) }));

    res.json({ data: enriched, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/waiter/orders/by-table/:tableId
// Returns all orders for a table (active + completed + void), newest first.
// Must be registered before any /:id wildcard route.
router.get('/by-table/:tableId', ...staffAuth, async (req, res, next) => {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId }).lean();
    if (!table) return res.json({ data: [], meta: { request_id: req.requestId } });

    const orders = await Order.find({ tableId: table._id, restaurantId: req.restaurantId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const orderIds = orders.map(o => o._id);
    const allItems = orderIds.length
      ? await OrderItem.find({ orderId: { $in: orderIds } }).lean()
      : [];

    const data = orders.map(o => {
      const items = allItems.filter(i => i.orderId.toString() === o._id.toString());
      const total = items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);
      return {
        _id:         o._id,
        status:      o.status,
        createdAt:   o.createdAt,
        totalAmount: Math.round(total * 100) / 100,
        itemCount:   items.length,
      };
    });

    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
