const router = require('express').Router({ mergeParams: true });
const RestaurantReview = require('../../models/RestaurantReview');
const DishReview       = require('../../models/DishReview');
const { requireAuth }  = require('../../middleware/auth');
const { requireRole }  = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const requirePlan = require('../../middleware/requirePlan');
const { notFound, badRequest } = require('../../middleware/validate');

const adminAuth = [requireAuth, requireRole('admin'), requireSameRestaurant, requirePlan('premium')];

function paginate(q) {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

router.get('/', ...adminAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { restaurantId: req.restaurantId };
    if (req.query.rating) filter.rating = parseInt(req.query.rating);

    const from = req.query.from ? new Date(req.query.from) : undefined;
    const to   = req.query.to   ? new Date(req.query.to)   : undefined;
    if (from || to) filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to)   filter.createdAt.$lte = to;

    // ?type=dish → all dish reviews; ?menuItemId=... → dish reviews for specific item
    if (req.query.type === 'dish' || req.query.menuItemId) {
      if (req.query.menuItemId) filter.menuItemId = req.query.menuItemId;
      const [reviews, total] = await Promise.all([
        DishReview.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip).limit(limit)
          .populate('userId', 'name')
          .populate('menuItemId', 'name')
          .lean(),
        DishReview.countDocuments(filter),
      ]);
      return res.json({ data: reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
    }

    const [reviews, total] = await Promise.all([
      RestaurantReview.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit)
        .populate('userId', 'name')
        .lean(),
      RestaurantReview.countDocuments(filter),
    ]);
    res.json({ data: reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// DELETE /admin/reviews/:id?type=restaurant|dish
router.delete('/:id', ...adminAuth, async (req, res, next) => {
  try {
    const { type } = req.query;
    if (!['restaurant', 'dish'].includes(type)) {
      return next(badRequest('type must be "restaurant" or "dish"'));
    }
    const Model = type === 'dish' ? DishReview : RestaurantReview;
    const review = await Model.findOneAndDelete({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!review) return next(notFound('Review not found'));
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
