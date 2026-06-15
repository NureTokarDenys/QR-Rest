const router       = require('express').Router({ mergeParams: true });
const Notification = require('../models/Notification');
const Order        = require('../models/Order');
const Session      = require('../models/Session');
const { optionalAuth } = require('../middleware/auth');
const { notFound }     = require('../middleware/validate');

function respond(res, req, data) {
  res.json({ data, meta: { request_id: req.requestId } });
}

// Allows access if:
//   1. JWT-authenticated user who owns the order (req.user._id === order.userId), OR
//   2. Session token matches the order's session token directly, OR
//   3. Session token belongs to an active session at the same table (handles QR re-scans)
async function authorised(order, sessionToken, userId) {
  if (userId && order.userId && order.userId.toString() === userId.toString()) return true;
  if (!sessionToken) return false;
  if (order.sessionToken === sessionToken) return true;
  const session = await Session.findOne({ token: sessionToken, isActive: true });
  return !!(session && session.tableId.toString() === order.tableId.toString());
}

// GET /:orderId/notifications
router.get('/:orderId/notifications', optionalAuth, async (req, res, next) => {
  try {
    const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    if (!await authorised(order, sessionToken, req.user?._id)) {
      return res.status(403).json({
        error: { code: 'ORDER_ACCESS_DENIED', message: 'You do not have access to this order' },
        meta: { request_id: req.requestId },
      });
    }

    const notifications = await Notification.find({ orderId: order._id }).sort({ createdAt: -1 }).lean();
    respond(res, req, notifications);
  } catch (err) { next(err); }
});

// PATCH /:orderId/notifications/read-all
router.patch('/:orderId/notifications/read-all', optionalAuth, async (req, res, next) => {
  try {
    const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];

    const order = await Order.findOne({ _id: req.params.orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    if (!await authorised(order, sessionToken, req.user?._id)) {
      return res.status(403).json({
        error: { code: 'ORDER_ACCESS_DENIED', message: 'You do not have access to this order' },
        meta: { request_id: req.requestId },
      });
    }

    const result = await Notification.updateMany(
      { orderId: order._id, readAt: null },
      { readAt: new Date() }
    );

    respond(res, req, { markedRead: result.modifiedCount });
  } catch (err) { next(err); }
});

module.exports = router;
