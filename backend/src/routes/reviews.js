const mongoose    = require('mongoose');
const router      = require('express').Router({ mergeParams: true });
const RestaurantReview = require('../models/RestaurantReview');
const DishReview       = require('../models/DishReview');
const Order            = require('../models/Order');
const OrderItem        = require('../models/OrderItem');
const { requireAuth }  = require('../middleware/auth');
const { requireRole }  = require('../middleware/rbac');
const { badRequest, notFound } = require('../middleware/validate');
const requirePlan = require('../middleware/requirePlan');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginate(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function buildSummary(Model, matchFilter) {
  const agg = await Model.aggregate([
    { $match: matchFilter },
    { $group: { _id: null, average: { $avg: '$rating' }, total: { $sum: 1 } } },
  ]);
  return agg[0]
    ? { averageRating: Math.round(agg[0].average * 10) / 10, totalCount: agg[0].total }
    : { averageRating: 0, totalCount: 0 };
}

// ─── GET  /:restaurantId/reviews/restaurant  — public listing ─────────────────

router.get('/restaurant', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { restaurantId: req.restaurantId };

    const [reviews, total, summary] = await Promise.all([
      RestaurantReview.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name')
        .lean(),
      RestaurantReview.countDocuments(filter),
      buildSummary(RestaurantReview, filter),
    ]);

    res.json({
      data: reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary,
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// ─── GET  /:restaurantId/reviews/dish/:menuItemId  — public listing ───────────

router.get('/dish/:menuItemId', async (req, res, next) => {
  try {
    let menuItemOid;
    try { menuItemOid = new mongoose.Types.ObjectId(req.params.menuItemId); }
    catch { return next(badRequest('Invalid menuItemId')); }

    const { page, limit, skip } = paginate(req.query);
    const filter = { menuItemId: menuItemOid, restaurantId: req.restaurantId };

    const [reviews, total, summary] = await Promise.all([
      DishReview.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name')
        .lean(),
      DishReview.countDocuments(filter),
      buildSummary(DishReview, filter),
    ]);

    res.json({
      data: reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary,
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// ─── GET /:restaurantId/reviews/my/:orderId ──────────────────────────────────
// Returns the authenticated guest's reviews left for a specific order:
//   { restaurantReview: <doc|null>, dishReviews: [{ orderItemId, review }] }
// Used by the order-status / order-history "leave a review" UI so it can
// pre-fill submitted reviews and disable already-rated entries.

router.get('/my/:orderId', requireAuth, requireRole('guest'), async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      restaurantId: req.restaurantId,
      userId: req.user._id,
    }).lean();
    if (!order) return next(notFound('Order not found'));

    const items = await OrderItem.find({ orderId: order._id }).select('_id').lean();
    const orderItemIds = items.map(i => i._id);

    const [restaurantReview, dishReviews] = await Promise.all([
      RestaurantReview.findOne({ orderId: order._id, userId: req.user._id }).lean(),
      DishReview.find({ orderItemId: { $in: orderItemIds }, userId: req.user._id }).lean(),
    ]);

    res.json({
      data: { restaurantReview, dishReviews },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// ─── POST /:restaurantId/reviews/restaurant ───────────────────────────────────

router.post('/restaurant', requireAuth, requireRole('guest'), requirePlan('premium'), async (req, res, next) => {
  try {
    const { orderId, rating, comment } = req.body;
    if (!orderId || !rating)         return next(badRequest('orderId and rating are required'));
    if (rating < 1 || rating > 5)    return next(badRequest('Rating must be between 1 and 5'));

    const order = await Order.findOne({
      _id: orderId, restaurantId: req.restaurantId,
      userId: req.user._id, status: { $in: ['open_paid', 'completed_cash', 'completed_epay'] },
    });
    if (!order) return next(notFound('Paid order not found'));

    const review = await RestaurantReview.create({
      userId: req.user._id, orderId, restaurantId: req.restaurantId, rating, comment,
    });
    res.status(201).json({ data: review, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ─── POST /:restaurantId/reviews/dish ────────────────────────────────────────

router.post('/dish', requireAuth, requireRole('guest'), requirePlan('premium'), async (req, res, next) => {
  try {
    const { orderItemId, rating, comment } = req.body;
    if (!orderItemId || !rating)     return next(badRequest('orderItemId and rating are required'));
    if (rating < 1 || rating > 5)    return next(badRequest('Rating must be between 1 and 5'));

    const orderItem = await OrderItem.findById(orderItemId).lean();
    if (!orderItem) return next(notFound('Order item not found'));

    const order = await Order.findOne({
      _id: orderItem.orderId, restaurantId: req.restaurantId,
      userId: req.user._id, status: { $in: ['open_paid', 'completed_cash', 'completed_epay'] },
    });
    if (!order) return next(notFound('Paid order not found'));

    const review = await DishReview.create({
      userId: req.user._id, orderItemId,
      menuItemId: orderItem.menuItemId,
      restaurantId: req.restaurantId, rating, comment,
    });
    res.status(201).json({ data: review, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
