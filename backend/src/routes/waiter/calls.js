const router = require('express').Router({ mergeParams: true });
const WaiterCall = require('../../models/WaiterCall');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound, badRequest } = require('../../middleware/validate');
const { emit } = require('../../services/wsService');

const staffAuth = [requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant];

function paginate(q) {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

router.get('/', ...staffAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { restaurantId: req.restaurantId };
    if (req.query.status) filter.status = req.query.status;
    else if (req.query.active === 'true') filter.status = 'active';

    const [calls, total] = await Promise.all([
      WaiterCall.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WaiterCall.countDocuments(filter),
    ]);
    res.json({ data: calls, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.patch('/:callId/resolve', ...staffAuth, async (req, res, next) => {
  try {
    const call = await WaiterCall.findOne({ _id: req.params.callId, restaurantId: req.restaurantId });
    if (!call) return next(notFound('Waiter call not found'));
    if (call.status === 'resolved') return next(badRequest('Waiter call is already resolved'));

    call.status     = 'resolved';
    call.resolvedAt = new Date();
    call.resolvedBy = req.user._id;
    await call.save();

    emit(`table:${call.tableId}`,        'WAITER_CALL_RESOLVED', { callId: call._id, tableId: call.tableId, type: call.type, resolvedAt: call.resolvedAt });
    emit(`session:${call.sessionToken}`, 'WAITER_CALL_RESOLVED', { callId: call._id, tableId: call.tableId, type: call.type, resolvedAt: call.resolvedAt });
    emit(`waiter:${req.restaurantId}`,   'WAITER_CALL_RESOLVED', { callId: call._id, tableId: call.tableId, type: call.type, resolvedAt: call.resolvedAt });

    // cash_payment calls: payment is already applied automatically when the
    // client submits the request (waiter-call-cash endpoint). Nothing to do
    // here except resolving the call itself (done above).

    res.json({ data: call, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
