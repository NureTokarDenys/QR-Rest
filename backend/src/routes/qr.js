const router = require('express').Router();
const Table = require('../models/Table');
const Order = require('../models/Order');
const { joinSession } = require('../services/sessionService');
const { deviceFingerprint } = require('../utils/fingerprint');
const { notFound } = require('../middleware/validate');

// GET /qr/:shortCode — guest scans a QR code
router.get('/:shortCode', async (req, res, next) => {
  try {
    const table = await Table.findOne({ shortCode: req.params.shortCode.toUpperCase() });
    if (!table) return next(notFound('Table not found'));

    if (table.status === 'disabled') {
      return res.status(200).json({
        data: { available: false, message: 'Table is currently unavailable' },
        meta: { request_id: req.requestId },
      });
    }

    const fingerprint          = deviceFingerprint(req);
    const existingSessionToken = req.cookies?.session_token || null;
    const result               = await joinSession(table, fingerprint, existingSessionToken);

    if (result.error === 'SESSION_CLOSED') {
      return res.status(403).json({
        error: {
          code:       'SESSION_CLOSED',
          message:    'Table session has ended.',
          message_uk: 'Сесію столика завершено.',
        },
        meta: { request_id: req.requestId },
      });
    }

    if (result.error === 'SESSION_RECOVERY_CLAIMED') {
      return res.status(403).json({
        error: {
          code:       'SESSION_RECOVERY_CLAIMED',
          message:    'Session recovery has already been used. Ask the waiter to open a new recovery.',
          message_uk: 'Відновлення сесії вже використано. Зверніться до офіціанта для нового відновлення.',
        },
        meta: { request_id: req.requestId },
      });
    }

    const { session, isNew, isRecovery = false } = result;

    const Restaurant = require('../models/Restaurant');
    const [restaurant, existingOrder] = await Promise.all([
      Restaurant.findById(table.restaurantId).select('name plan').lean(),
      Order.findOne({
        tableId: table._id,
        status: { $nin: ['cancelled', 'completed_cash', 'completed_epay'] },
      }).select('_id').lean(),
    ]);

    res
      .cookie('session_token', session.token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires:  session.expiresAt,
      })
      .json({
        data: {
          sessionToken:        session.token,
          tableId:             table._id,
          tableNumber:         table.number,
          restaurantId:        restaurant?._id ?? null,
          restaurantName:      restaurant?.name ?? null,
          restaurantPlan:      restaurant?.plan ?? 'free',
          isNew,
          isRecovery,
          expiresAt:           session.expiresAt,
          tableHasActiveOrder: !!existingOrder,
          activeOrderId:       existingOrder?._id ?? null,
        },
        meta: { request_id: req.requestId },
      });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
