const router     = require('express').Router({ mergeParams: true });
const Order      = require('../models/Order');
const Payment    = require('../models/Payment');
const Restaurant = require('../models/Restaurant');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole }           = require('../middleware/rbac');
const { requireSameRestaurant } = require('../middleware/restaurantParam');
const { badRequest, notFound, orderNotPayable, orderFinalized, sessionMismatch, createError } = require('../middleware/validate');
const auditService              = require('../services/auditService');
const { emit }                  = require('../services/wsService');
const { recalcTableStatus } = require('../services/orderService');
const { createNotification }    = require('../services/notificationService');
const { createLiqpayService }   = require('../services/liqpayService');
const { decrypt }               = require('../services/encryptionService');

// ── Validation cache: { restaurantId → { available, reason, checkedAt } } ──────
const cardStatusCache = new Map();
const CARD_CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

// GET /:restaurantId/payments/card-available — no auth, used by client before checkout
// Checks whether LiqPay is configured AND that the stored keys are accepted by LiqPay.
router.get('/card-available', async (req, res, next) => {
  try {
    // Serve from cache if fresh
    const cached = cardStatusCache.get(String(req.restaurantId));
    if (cached && Date.now() - cached.checkedAt < CARD_CACHE_TTL) {
      return res.json({ data: { available: cached.available, reason: cached.reason }, meta: { request_id: req.requestId } });
    }

    const restaurant = await Restaurant.findById(req.restaurantId)
      .select('liqpayPublicKey liqpayPrivateKeyEnc liqpayPrivateKeyIV liqpayPrivateKeyTag').lean();

    // ── 1. Keys not stored ─────────────────────────────────────────────────
    if (!restaurant?.liqpayPublicKey || !restaurant?.liqpayPrivateKeyEnc) {
      const result = { available: false, reason: 'not_configured' };
      cardStatusCache.set(String(req.restaurantId), { ...result, checkedAt: Date.now() });
      return res.json({ data: result, meta: { request_id: req.requestId } });
    }

    // ── 2. Decrypt private key ─────────────────────────────────────────────
    let privateKey;
    try {
      privateKey = decrypt(
        restaurant.liqpayPrivateKeyEnc,
        restaurant.liqpayPrivateKeyIV,
        restaurant.liqpayPrivateKeyTag,
      );
    } catch (_) {
      const result = { available: false, reason: 'invalid_credentials' };
      cardStatusCache.set(String(req.restaurantId), { ...result, checkedAt: Date.now() });
      return res.json({ data: result, meta: { request_id: req.requestId } });
    }

    // ── 3. Live validation against LiqPay ─────────────────────────────────
    const liqpay     = createLiqpayService(restaurant.liqpayPublicKey, privateKey);
    const validation = await liqpay.validateKeys();

    if (!validation.valid) {
      const result = { available: false, reason: validation.reason || 'invalid_credentials' };
      cardStatusCache.set(String(req.restaurantId), { ...result, checkedAt: Date.now() });
      return res.json({ data: result, meta: { request_id: req.requestId } });
    }

    const result = { available: true, reason: 'ok' };
    cardStatusCache.set(String(req.restaurantId), { ...result, checkedAt: Date.now() });
    res.json({ data: result, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// POST /:restaurantId/payments/initiate — LiqPay online payment
router.post('/initiate', optionalAuth, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return next(badRequest('orderId is required'));

    const sessionToken = req.cookies?.session_token || req.headers['x-session-token'];
    const order = await Order.findOne({ _id: orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));

    const isOwner     = sessionToken && order.sessionToken === sessionToken;
    const isAuthOwner = req.user && order.userId?.toString() === req.user._id.toString();
    if (!isOwner && !isAuthOwner) return next(sessionMismatch());
    if (['cancelled', 'completed_cash', 'completed_epay', 'open_paid'].includes(order.status)) {
      return next(orderNotPayable());
    }

    // Load restaurant's LiqPay keys
    const restaurant = await Restaurant.findById(req.restaurantId)
      .select('liqpayPublicKey liqpayPrivateKeyEnc liqpayPrivateKeyIV liqpayPrivateKeyTag').lean();
    if (!restaurant?.liqpayPublicKey || !restaurant?.liqpayPrivateKeyEnc) {
      return next(createError(400, 'PAYMENT_NOT_CONFIGURED', 'Online payments are not configured for this restaurant'));
    }

    const privateKey = decrypt(
      restaurant.liqpayPrivateKeyEnc,
      restaurant.liqpayPrivateKeyIV,
      restaurant.liqpayPrivateKeyTag,
    );
    const liqpay = createLiqpayService(restaurant.liqpayPublicKey, privateKey);

    const items = await require('../models/OrderItem').find({ orderId: order._id }).lean();
    const amount = items.reduce((sum, i) => {
      const compMod = (i.componentGroupChoices || []).reduce((s, c) => s + (c.priceModifier || 0), 0);
      const aoTotal = (i.addons || []).reduce((s, a) => s + (a.price ?? 0) * (a.quantity ?? 1), 0);
      return sum + (i.unitPrice + compMod) * i.quantity + aoTotal;
    }, 0);

    const payment = await Payment.create({ orderId: order._id, restaurantId: req.restaurantId, amount, method: 'online' });

    // result_url — where LiqPay redirects the user's browser after checkout.
    // Skipped for localhost because LiqPay rejects non-public URLs.
    const rawBase   = process.env.BASE_URL || '';
    const resultUrl = rawBase && !/localhost|127\.0\.0\.1/.test(rawBase)
      ? `${rawBase}/order-status/${order._id}`
      : undefined;

    // server_url points to the frontend relay (port 3000, ngrok-exposed).
    // The Vite/production server intercepts POST /liqpay/callback/order/:id
    // and forwards it to the local backend — port 5000 never needs to be public.
    const serverUrl = rawBase && !/localhost|127\.0\.0\.1/.test(rawBase)
      ? `${rawBase}/liqpay/callback/order/${req.restaurantId}`
      : undefined;

    const { data, signature, publicKey } = await liqpay.createPayment({
      orderId:    payment._id.toString(),
      amount,
      description: `Order #${order.publicId ?? order._id}`,
      serverUrl,
      resultUrl,
    });

    emit(`table:${order.tableId}`, 'PAYMENT_INITIATED', { orderId: order._id, method: 'ONLINE', tableId: order.tableId });

    res.json({ data: { data, signature, publicKey }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// POST /:restaurantId/payments/cash — waiter/admin records cash payment
router.post('/cash', requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return next(badRequest('orderId is required'));

    const order = await Order.findOne({ _id: orderId, restaurantId: req.restaurantId });
    if (!order) return next(notFound('Order not found'));
    if (['cancelled', 'completed_cash', 'completed_epay', 'open_paid'].includes(order.status)) return next(orderFinalized());

    const items  = await require('../models/OrderItem').find({ orderId: order._id }).lean();
    const amount = items.reduce((sum, i) => {
      const compMod = (i.componentGroupChoices || []).reduce((s, c) => s + (c.priceModifier || 0), 0);
      const aoTotal = (i.addons || []).reduce((s, a) => s + (a.price ?? 0) * (a.quantity ?? 1), 0);
      return sum + (i.unitPrice + compMod) * i.quantity + aoTotal;
    }, 0);

    const payment = await Payment.create({ orderId: order._id, restaurantId: req.restaurantId, amount, method: 'cash', status: 'completed', processedBy: req.user._id });

    order.status        = 'completed_cash';
    order.paymentMethod = 'cash';
    await order.save();

    try {
      await auditService.log({
        restaurantId: req.restaurantId,
        eventType:    'CASH_PAYMENT',
        orderId:      order._id,
        tableId:      order.tableId,
        initiatedBy:  { userId: req.user._id, role: req.user.role },
        amount,
        paymentMethod: 'CASH',
        receipt:      auditService.buildReceipt(items),
        meta: { sessionToken: order.sessionToken, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      });
    } catch (e) { console.error('payments/cash: auditService.log failed', e?.message); }

    try { await recalcTableStatus(order.tableId); }
    catch (e) { console.error('payments/cash: recalcTableStatus failed', e?.message); }

    const completedAt = new Date();
    emit(`session:${order.sessionToken}`, 'PAYMENT_COMPLETED', { orderId: order._id, method: 'cash', amount, completedAt });
    emit(`table:${order.tableId}`,        'PAYMENT_COMPLETED', { orderId: order._id, method: 'cash', amount, completedAt });
    emit(`kitchen:${req.restaurantId}`,   'PAYMENT_COMPLETED', { orderId: order._id, method: 'cash', amount, completedAt });
    emit(`waiter:${req.restaurantId}`,    'PAYMENT_COMPLETED', { orderId: order._id, method: 'cash', amount, completedAt });

    emit(`session:${order.sessionToken}`, 'ORDER_COMPLETED', { orderId: order._id, status: 'completed_cash' });
    emit(`table:${order.tableId}`,        'ORDER_COMPLETED', { orderId: order._id, status: 'completed_cash' });
    emit(`kitchen:${req.restaurantId}`,   'ORDER_COMPLETED', { orderId: order._id, status: 'completed_cash' });
    emit(`waiter:${req.restaurantId}`,    'ORDER_COMPLETED', { orderId: order._id, status: 'completed_cash' });

    try {
      await createNotification({ orderId: order._id, restaurantId: req.restaurantId, sessionToken: order.sessionToken, tableId: order.tableId, type: 'payment_completed_cash', data: { amount } });
    } catch (e) { console.error('payments/cash: createNotification failed', e?.message); }

    res.json({ data: { orderId: order._id, amount, method: 'cash', status: 'completed_cash' }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.cardStatusCache = cardStatusCache;
