const router = require('express').Router({ mergeParams: true });
const AuditLog = require('../../models/AuditLog');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');

const adminAuth = [requireAuth, requireRole('admin'), requireSameRestaurant];

// Immutable — mutations are not allowed
router.put('*',    (req, res) => res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'AuditLog records are immutable' }, meta: {} }));
router.patch('*',  (req, res) => res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'AuditLog records are immutable' }, meta: {} }));
router.delete('*', (req, res) => res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'AuditLog records are immutable' }, meta: {} }));
router.post('*',   (req, res) => res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'AuditLog records are immutable' }, meta: {} }));

router.get('/', ...adminAuth, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = { restaurantId: req.restaurantId };
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to)   filter.timestamp.$lte = new Date(req.query.to);
    }
    if (req.query.eventType) filter.eventType               = req.query.eventType;
    if (req.query.orderId)   filter.orderId                 = req.query.orderId;
    if (req.query.userId)    filter['initiatedBy.userId']   = req.query.userId;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ data: logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
