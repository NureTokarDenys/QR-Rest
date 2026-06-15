const router = require('express').Router();
const User       = require('../models/User');
const Order      = require('../models/Order');
const OrderItem  = require('../models/OrderItem');
const Restaurant = require('../models/Restaurant');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { badRequest } = require('../middleware/validate');

function paginate(q) {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// GET /user/profile
router.get('/profile', requireAuth, (req, res) => {
  res.json({ data: req.user, meta: { request_id: req.requestId } });
});

// PUT /user/profile
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const user = await User.findById(req.user._id);
    if (name) user.name = name;
    if (password) {
      if (password.length < 8) return next(badRequest('Password must be at least 8 characters'));
      user.passwordHash = await User.hashPassword(password);
    }
    await user.save();
    res.json({ data: { _id: user._id, name: user.name, email: user.email, role: user.role }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// DELETE /user/account
router.delete('/account', requireAuth, requireRole('guest'), async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      name: 'Deleted User',
      email: `deleted_${req.user._id}@deleted.local`,
      googleId: undefined,
      passwordHash: undefined,
      isActive: false,
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /user/orders
router.get('/orders', requireAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);

    // Compute per-order totals from OrderItems + fetch restaurant names in parallel
    const orderIds       = orders.map(o => o._id);
    const restaurantIds  = [...new Set(orders.map(o => String(o.restaurantId)).filter(Boolean))];

    const [agg, restaurants] = await Promise.all([
      OrderItem.aggregate([
        { $match: { orderId: { $in: orderIds } } },
        { $group: { _id: '$orderId', total: { $sum: { $multiply: ['$unitPrice', '$quantity'] } } } },
      ]),
      Restaurant.find({ _id: { $in: restaurantIds } }).select('name translations').lean(),
    ]);

    const totalsMap = Object.fromEntries(agg.map(a => [String(a._id), a.total]));
    const restMap   = Object.fromEntries(restaurants.map(r => [String(r._id), r]));

    const enriched = orders.map(o => {
      const rest = restMap[String(o.restaurantId)];
      return {
        _id:               o._id,
        status:            o.status,
        createdAt:         o.createdAt,
        restaurantId:      o.restaurantId,
        restaurantName:    rest?.name || '',
        restaurantName_en: rest?.translations?.en?.name?.value || rest?.name || '',
        totalAmount:       Math.round((totalsMap[String(o._id)] || 0) * 100) / 100,
      };
    });

    // Prevent 304 caching — order list changes frequently
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: enriched, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
