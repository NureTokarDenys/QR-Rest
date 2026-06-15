const router = require('express').Router({ mergeParams: true });
const User   = require('../../models/User');
const crypto = require('crypto');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound, badRequest, conflict } = require('../../middleware/validate');
const PasswordReset = require('../../models/PasswordReset');
const { sendStaffWelcome, sendPasswordReset, sendAccountDeactivated, sendAccountActivated } = require('../../services/emailService');
const { emit } = require('../../services/wsService');

const adminAuth = [requireAuth, requireRole('admin'), requireSameRestaurant];

function paginate(q) {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function loginUrl() {
  return (process.env.APP_URL || 'http://localhost:5173') + '/login';
}

router.get('/', ...adminAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { restaurantId: req.restaurantId, role: { $in: ['cook', 'waiter', 'waiter_cook', 'admin', 'root_admin'] } };
    if (req.query.role)     filter.role     = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [staff, total] = await Promise.all([
      User.find(filter).select('-passwordHash').skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    res.json({ data: staff, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

const FREE_STAFF_LIMIT = 3;

router.post('/', ...adminAuth, async (req, res, next) => {
  try {
    const { email, name, role } = req.body;
    if (!email || !name || !role) return next(badRequest('email, name and role are required'));
    if (!['cook', 'waiter', 'waiter_cook', 'admin'].includes(role)) return next(badRequest('role must be cook, waiter, waiter_cook, or admin'));

    const Restaurant = require('../../models/Restaurant');
    const restaurant = await Restaurant.findById(req.restaurantId).lean();
    if ((restaurant?.plan || 'free') === 'free') {
      const staffCount = await User.countDocuments({ restaurantId: req.restaurantId, role: { $in: ['cook', 'waiter', 'waiter_cook', 'admin', 'root_admin'] } });
      if (staffCount >= FREE_STAFF_LIMIT) {
        return res.status(403).json({
          error: { code: 'PLAN_LIMIT_REACHED', message: `Free plan allows up to ${FREE_STAFF_LIMIT} staff accounts`, requiredPlan: 'premium', limitType: 'staff', limit: FREE_STAFF_LIMIT },
          meta: {},
        });
      }
    }

    const exists = await User.findOne({ email });
    if (exists) return next(conflict('Email already registered'));

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await User.hashPassword(tempPassword);

    const restaurantName = restaurant?.name || '';

    const user = await User.create({ name, email, passwordHash, role, restaurantId: req.restaurantId });

    // Send welcome email asynchronously — don't block the response
    sendStaffWelcome({ to: email, name, restaurantName, tempPassword, role, loginUrl: loginUrl() })
      .catch(err => console.error('Failed to send staff welcome email:', err));

    emit(`restaurant:${req.restaurantId}`, 'STAFF_CREATED', { userId: user._id });
    res.status(201).json({ data: { _id: user._id, name: user.name, email: user.email, role: user.role, tempPassword }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.get('/:userId', ...adminAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, restaurantId: req.restaurantId }).select('-passwordHash').lean();
    if (!user) return next(notFound('Staff member not found'));
    res.json({ data: user, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/:userId/role', ...adminAuth, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['cook', 'waiter', 'waiter_cook', 'admin'].includes(role)) return next(badRequest('Invalid role'));
    const user = await User.findOne({ _id: req.params.userId, restaurantId: req.restaurantId });
    if (!user) return next(notFound('Staff member not found'));
    if (user.role === 'root_admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'The root admin role cannot be changed' },
        meta: { request_id: req.requestId },
      });
    }
    if ((user.role === 'admin' || role === 'admin') && req.user.role !== 'root_admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the root admin can assign or remove the admin role' },
        meta: { request_id: req.requestId },
      });
    }
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You cannot change your own role' },
        meta: { request_id: req.requestId },
      });
    }
    user.role = role;
    await user.save();
    emit(`restaurant:${req.restaurantId}`, 'STAFF_UPDATED', { userId: user._id, role: user.role });
    res.json({ data: { _id: user._id, role: user.role }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/:userId/deactivate', ...adminAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, restaurantId: req.restaurantId });
    if (!user) return next(notFound('Staff member not found'));
    if (user.role === 'root_admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'The root admin account cannot be deactivated' },
        meta: { request_id: req.requestId },
      });
    }
    user.isActive = false;
    await user.save();

    const Restaurant = require('../../models/Restaurant');
    const restaurant  = await Restaurant.findById(req.restaurantId).lean();
    const restaurantName = restaurant?.name || '';
    sendAccountDeactivated({ to: user.email, name: user.name, email: user.email, restaurantName })
      .catch(err => console.error('Failed to send deactivation email:', err));

    emit(`restaurant:${req.restaurantId}`, 'STAFF_UPDATED', { userId: user._id, isActive: false });
    res.json({ data: { _id: user._id, isActive: false }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/:userId/activate', ...adminAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, restaurantId: req.restaurantId });
    if (!user) return next(notFound('Staff member not found'));
    user.isActive = true;
    await user.save();

    const Restaurant = require('../../models/Restaurant');
    const restaurant  = await Restaurant.findById(req.restaurantId).lean();
    const restaurantName = restaurant?.name || '';
    sendAccountActivated({ to: user.email, name: user.name, email: user.email, restaurantName, loginUrl: loginUrl() })
      .catch(err => console.error('Failed to send activation email:', err));

    emit(`restaurant:${req.restaurantId}`, 'STAFF_UPDATED', { userId: user._id, isActive: true });
    res.json({ data: { _id: user._id, isActive: true }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/:userId/reset-password', ...adminAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, restaurantId: req.restaurantId });
    if (!user) return next(notFound('Staff member not found'));

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({ userId: user._id, tokenHash, expiresAt });

    const appUrl   = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${appUrl}/forgot-password?token=${rawToken}`;

    sendPasswordReset({ to: user.email, name: user.name, resetUrl })
      .catch(err => console.error('Failed to send password-reset email:', err));

    res.json({ data: { sent: true }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
