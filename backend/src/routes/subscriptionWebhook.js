const router     = require('express').Router();
const Restaurant = require('../models/Restaurant');
const { getPlatformService, decodeWebhookData } = require('../services/liqpayService');
const { emit } = require('../services/wsService');
const logger = require('../config/logger');

// POST /api/subscriptions/webhook/liqpay
router.post('/liqpay', async (req, res) => {
  try {
    const { data, signature } = req.body;
    if (!data || !signature) return res.status(400).send('Bad Request');

    if (!getPlatformService().verifyWebhook(data, signature)) {
      logger.warn('subscription_webhook_invalid_signature', { ip: req.ip });
      return res.status(400).send('Invalid signature');
    }

    const payload = decodeWebhookData(data);

    logger.info('subscription_webhook_received', {
      status:    payload.status,
      action:    payload.action,
      order_id:  payload.order_id,
      amount:    payload.amount,
      currency:  payload.currency,
    });

    // order_id format: sub_<restaurantId>_<timestamp>
    const parts = (payload.order_id || '').split('_');
    if (parts[0] !== 'sub' || !parts[1]) {
      logger.warn('subscription_webhook_unknown_order', { order_id: payload.order_id });
      return res.status(200).send('OK');
    }
    const restaurantId = parts[1];

    // LiqPay sends 'sandbox' status in test mode instead of 'subscribed'/'success'
    const ACTIVATE_STATUSES = new Set(['subscribed', 'success', 'sandbox', 'wait_accept']);

    if (ACTIVATE_STATUSES.has(payload.status)) {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1);
      await Restaurant.findByIdAndUpdate(restaurantId, {
        plan: 'premium',
        subscriptionStartDate: now,
        subscriptionEndDate: endDate,
        subscriptionCancelled: false,
      });
      emit(`restaurant:${restaurantId}`, 'RESTAURANT_UPDATED', { plan: 'premium' });
      logger.info('subscription_activated', { restaurantId, status: payload.status, transactionId: payload.transaction_id });
    } else if (payload.status === 'unsubscribed') {
      await Restaurant.findByIdAndUpdate(restaurantId, {
        $set: { plan: 'free', subscriptionCancelled: false },
        $unset: { subscriptionStartDate: '', subscriptionEndDate: '' },
      });
      emit(`restaurant:${restaurantId}`, 'RESTAURANT_UPDATED', { plan: 'free' });
      logger.info('subscription_deactivated', { restaurantId });
    } else {
      logger.info('subscription_payment_not_activated', { restaurantId, status: payload.status });
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error('subscription_webhook_error', { error: err.message });
    res.status(200).send('OK');
  }
});

module.exports = router;
