const router = require('express').Router({ mergeParams: true });
const Order     = require('../../models/Order');
const OrderItem = require('../../models/OrderItem');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const requirePlan = require('../../middleware/requirePlan');

const adminAuth = [requireAuth, requireRole('admin'), requireSameRestaurant, requirePlan('premium')];

function dateRange(from, to) {
  const start = from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000);
  const end   = to   ? new Date(to)   : new Date();
  // Make end inclusive — move to 23:59:59.999 UTC of the given date
  end.setUTCHours(23, 59, 59, 999);
  return { $gte: start, $lte: end };
}

// Revenue from completed orders — computed from OrderItems so both cash and epay are covered.
// Returns { total, count, breakdown: [{hour,revenue}] | [{date,revenue}] }
router.get('/revenue', ...adminAuth, async (req, res, next) => {
  try {
    const range = dateRange(req.query.from, req.query.to);

    const completedOrders = await Order.find({
      restaurantId: req.restaurantId,
      status: { $in: ['completed_cash', 'completed_epay'] },
      createdAt: range,
    }).select('_id createdAt').lean();

    const orderIds = completedOrders.map(o => o._id);
    let total = 0;
    let breakdown = [];

    if (orderIds.length > 0) {
      const revenueAgg = await OrderItem.aggregate([
        { $match: { orderId: { $in: orderIds } } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$unitPrice', '$quantity'] } } } },
      ]);
      total = revenueAgg[0]?.total ?? 0;

      // Decide granularity: ≤1 day → hourly, otherwise → daily
      const fromDate = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86_400_000);
      const toDate   = req.query.to   ? new Date(req.query.to)   : new Date();
      const diffDays = Math.ceil((toDate - fromDate) / 86_400_000);

      if (diffDays <= 1) {
        const hourly = await OrderItem.aggregate([
          { $match: { orderId: { $in: orderIds } } },
          { $lookup: { from: 'orders', localField: 'orderId', foreignField: '_id', as: 'order' } },
          { $unwind: '$order' },
          { $group: {
              _id: { $hour: { date: '$order.createdAt', timezone: 'UTC' } },
              revenue: { $sum: { $multiply: ['$unitPrice', '$quantity'] } },
          }},
          { $sort: { _id: 1 } },
        ]);
        breakdown = hourly.map(h => ({ hour: h._id, revenue: h.revenue }));
      } else {
        const daily = await OrderItem.aggregate([
          { $match: { orderId: { $in: orderIds } } },
          { $lookup: { from: 'orders', localField: 'orderId', foreignField: '_id', as: 'order' } },
          { $unwind: '$order' },
          { $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$order.createdAt' } },
              revenue: { $sum: { $multiply: ['$unitPrice', '$quantity'] } },
          }},
          { $sort: { _id: 1 } },
        ]);
        breakdown = daily.map(d => ({ date: d._id, revenue: d.revenue }));
      }
    }

    res.json({ data: { total, count: completedOrders.length, breakdown }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// Order counts by status
router.get('/orders', ...adminAuth, async (req, res, next) => {
  try {
    const range = dateRange(req.query.from, req.query.to);
    const stats = await Order.aggregate([
      { $match: { restaurantId: req.restaurantId, createdAt: range } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json({ data: stats, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// Top dishes by quantity, with per-dish revenue
router.get('/popular-dishes', ...adminAuth, async (req, res, next) => {
  try {
    const range = dateRange(req.query.from, req.query.to);
    const orders = await Order.find({
      restaurantId: req.restaurantId,
      status: { $in: ['completed_cash', 'completed_epay'] },
      createdAt: range,
    }).select('_id').lean();
    const orderIds = orders.map(o => o._id);

    const top = await OrderItem.aggregate([
      { $match: { orderId: { $in: orderIds } } },
      { $group: {
          _id:      '$menuItemId',
          totalQty: { $sum: '$quantity' },
          revenue:  { $sum: { $multiply: ['$unitPrice', '$quantity'] } },
          name:     { $first: '$menuItemName' },
      }},
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'menuitems', localField: '_id', foreignField: '_id', as: 'item' } },
      { $project: {
          menuItemId: '$_id',
          name:    { $ifNull: [{ $arrayElemAt: ['$item.name',    0] }, '$name'] },
          name_en: { $ifNull: [{ $arrayElemAt: ['$item.name_en', 0] }, ''] },
          totalQty: 1,
          revenue:  1,
      }},
    ]);

    res.json({ data: top, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// Top categories by quantity ordered
router.get('/top-categories', ...adminAuth, async (req, res, next) => {
  try {
    const range = dateRange(req.query.from, req.query.to);
    const orders = await Order.find({
      restaurantId: req.restaurantId,
      status: { $in: ['completed_cash', 'completed_epay'] },
      createdAt: range,
    }).select('_id').lean();
    const orderIds = orders.map(o => o._id);

    const top = await OrderItem.aggregate([
      { $match: { orderId: { $in: orderIds } } },
      { $lookup: { from: 'menuitems', localField: 'menuItemId', foreignField: '_id', as: 'item' } },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
      { $group: {
          _id:      '$item.categoryId',
          totalQty: { $sum: '$quantity' },
          revenue:  { $sum: { $multiply: ['$unitPrice', '$quantity'] } },
      }},
      { $sort: { totalQty: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
      { $project: {
          categoryId: '$_id',
          name:    { $ifNull: [{ $arrayElemAt: ['$cat.name',    0] }, '—'] },
          name_en: { $ifNull: [{ $arrayElemAt: ['$cat.name_en', 0] }, ''] },
          totalQty: 1,
          revenue:  1,
      }},
    ]);

    const maxQty = top[0]?.totalQty ?? 1;
    const COLORS = ['#1d7afc', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
    const result = top.map((c, i) => ({
      ...c,
      pct: Math.round((c.totalQty / maxQty) * 100),
      color: COLORS[i % COLORS.length],
    }));

    res.json({ data: result, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// Detailed CSV export: one row per order item, with order-level fields on the first item row
router.get('/export', ...adminAuth, async (req, res, next) => {
  try {
    const range = dateRange(req.query.from, req.query.to);

    const orders = await Order.find({ restaurantId: req.restaurantId, createdAt: range })
      .populate('tableId', 'number label')
      .sort({ createdAt: 1 })
      .lean();

    const orderIds = orders.map(o => o._id);
    const items = await OrderItem.find({ orderId: { $in: orderIds } }).lean();

    const itemsByOrder = {};
    items.forEach(item => {
      (itemsByOrder[item.orderId] = itemsByOrder[item.orderId] || []).push(item);
    });

    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const headers = ['orderId', 'table', 'status', 'paymentMethod', 'date', 'orderTotal', 'itemName', 'qty', 'unitPrice', 'itemTotal'];
    const rows = [headers.join(',')];

    orders.forEach(o => {
      const table = o.tableId?.number ?? '';
      const date  = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '';
      const orderItems = itemsByOrder[o._id] ?? [];
      const orderTotal = orderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2);

      if (orderItems.length === 0) {
        rows.push([escape(o._id), table, o.status, o.paymentMethod ?? '', escape(date), orderTotal, '', '', '', ''].join(','));
      } else {
        orderItems.forEach((item, idx) => {
          rows.push([
            idx === 0 ? escape(o._id)          : '',
            idx === 0 ? table                   : '',
            idx === 0 ? o.status                : '',
            idx === 0 ? (o.paymentMethod ?? '') : '',
            idx === 0 ? escape(date)            : '',
            idx === 0 ? orderTotal              : '',
            escape(item.menuItemName || ''),
            item.quantity,
            item.unitPrice.toFixed(2),
            (item.unitPrice * item.quantity).toFixed(2),
          ].join(','));
        });
      }
    });

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');
    // BOM so Excel opens UTF-8 correctly
    res.send('﻿' + csv);
  } catch (err) { next(err); }
});

module.exports = router;
