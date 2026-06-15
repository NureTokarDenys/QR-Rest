const router     = require('express').Router({ mergeParams: true });
const crypto     = require('crypto');
const Restaurant = require('../models/Restaurant');
const { requireAuth }           = require('../middleware/auth');
const { requireRole }           = require('../middleware/rbac');
const { requireSameRestaurant } = require('../middleware/restaurantParam');
const { badRequest }            = require('../middleware/validate');
const { getPlatformService }    = require('../services/liqpayService');
const { emit }                  = require('../services/wsService');
const logger                    = require('../config/logger');

const adminAuth = [requireAuth, requireRole('admin'), requireSameRestaurant];

// Single source of truth for the Premium plan price.
const PREMIUM_PRICE     = 800;
const PREMIUM_CURRENCY  = 'UAH';

// GET /:restaurantId/subscriptions/price — public to any authenticated staff,
// so the upgrade modal can show the exact amount before initiating payment.
router.get('/price', requireAuth, requireSameRestaurant, (req, res) => {
  res.json({
    data: { amount: PREMIUM_PRICE, currency: PREMIUM_CURRENCY, periodicity: 'month' },
    meta: { request_id: req.requestId },
  });
});

// POST /:restaurantId/subscriptions/initiate
router.post('/initiate', ...adminAuth, async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.restaurantId).lean();
    if (!restaurant) return next(badRequest('Restaurant not found'));

    const orderId   = `sub_${req.restaurantId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    // result_url intentionally omitted — localhost URLs are rejected by LiqPay's
    // validation. The frontend uses sessionStorage to detect the return instead.
    //
    // server_url points to the FRONTEND public URL (port 3000, exposed via ngrok).
    // A dedicated Vite plugin at /liqpay/callback/subscription receives the POST
    // from LiqPay and relays it to the local backend at /api/subscriptions/webhook/liqpay.
    // This way only port 3000 needs to be publicly exposed — port 5000 stays private.
    const rawServerUrl = process.env.BASE_URL
      ? `${process.env.BASE_URL}/liqpay/callback/subscription`
      : null;
    const serverUrl = rawServerUrl && !/localhost|127\.0\.0\.1/.test(rawServerUrl)
      ? rawServerUrl
      : undefined;

    // subscribe_date_start is required by LiqPay for the subscribe action —
    // without it the checkout redirects to main_error immediately.
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const subscribeStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // result_url — where LiqPay redirects the admin's browser after checkout.
    // Skipped for localhost because LiqPay rejects non-public URLs.
    const rawBase   = process.env.BASE_URL || '';
    const resultUrl = rawBase && !/localhost|127\.0\.0\.1/.test(rawBase)
      ? `${rawBase}/staff/restaurant-settings`
      : undefined;

    const { data, signature, publicKey } = await getPlatformService().createPayment({
      orderId,
      amount:      PREMIUM_PRICE,
      description: 'QR Rest Premium — місячна підписка',
      action:      'subscribe',
      extra: {
        subscribe_date_start: subscribeStart,
        subscribe_periodicity: 'month',
      },
      serverUrl,
      resultUrl,
    });

    res.json({ data: { data, signature, publicKey, amount: PREMIUM_PRICE, currency: PREMIUM_CURRENCY }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/subscriptions/status — subscription details for the admin panel
router.get('/status', ...adminAuth, async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.restaurantId)
      .select('plan subscriptionStartDate subscriptionEndDate subscriptionCancelled')
      .lean();
    if (!restaurant) return next(badRequest('Restaurant not found'));

    res.json({
      data: {
        plan:                  restaurant.plan,
        subscriptionStartDate: restaurant.subscriptionStartDate  || null,
        subscriptionEndDate:   restaurant.subscriptionEndDate    || null,
        subscriptionCancelled: !!restaurant.subscriptionCancelled,
      },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// POST /:restaurantId/subscriptions/cancel — cancel auto-renewal; plan stays premium until end date
router.post('/cancel', ...adminAuth, async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.restaurantId).lean();
    if (!restaurant) return next(badRequest('Restaurant not found'));
    if (restaurant.plan !== 'premium') {
      return res.status(400).json({
        error: { code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active premium subscription' },
        meta:  { request_id: req.requestId },
      });
    }
    if (restaurant.subscriptionCancelled) {
      return res.status(400).json({
        error: { code: 'ALREADY_CANCELLED', message: 'Subscription is already marked for cancellation' },
        meta:  { request_id: req.requestId },
      });
    }

    await Restaurant.findByIdAndUpdate(req.restaurantId, { subscriptionCancelled: true });
    emit(`restaurant:${req.restaurantId}`, 'RESTAURANT_UPDATED', { subscriptionCancelled: true });
    logger.info('subscription_cancel_requested', { restaurantId: req.restaurantId });

    res.json({ data: { cancelled: true }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
