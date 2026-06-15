const router     = require('express').Router();
const Order      = require('../models/Order');
const Payment    = require('../models/Payment');
const Restaurant = require('../models/Restaurant');
const { createLiqpayService, decodeWebhookData } = require('../services/liqpayService');
const { decrypt }             = require('../services/encryptionService');
const { emit }                = require('../services/wsService');
const auditService            = require('../services/auditService');
const { createNotification }  = require('../services/notificationService');
const logger                  = require('../config/logger');

// POST /api/payments/webhook/liqpay/:restaurantId
router.post('/liqpay/:restaurantId', async (req, res) => {
  try {
    const { data, signature } = req.body;
    if (!data || !signature) return res.status(400).send('Bad Request');

    const restaurant = await Restaurant.findById(req.params.restaurantId)
      .select('liqpayPublicKey liqpayPrivateKeyEnc liqpayPrivateKeyIV liqpayPrivateKeyTag').lean();

    if (!restaurant?.liqpayPrivateKeyEnc) {
      logger.warn('payment_webhook_no_keys', { restaurantId: req.params.restaurantId, ip: req.ip });
      return res.status(400).send('Restaurant payment keys not configured');
    }

    const privateKey = decrypt(
      restaurant.liqpayPrivateKeyEnc,
      restaurant.liqpayPrivateKeyIV,
      restaurant.liqpayPrivateKeyTag,
    );
    const liqpay = createLiqpayService(restaurant.liqpayPublicKey, privateKey);

    if (!liqpay.verifyWebhook(data, signature)) {
      logger.warn('payment_webhook_invalid_signature', { restaurantId: req.params.restaurantId, ip: req.ip });
      return res.status(400).send('Invalid signature');
    }

    const payload = decodeWebhookData(data);
    const payment = await Payment.findById(payload.order_id);
    if (!payment) return res.status(200).send('OK');

    // LiqPay sends status:'success' for live payments and status:'sandbox'
    // for test-mode payments. Treat both as a completed payment.
    const isSuccess = payload.status === 'success' || payload.status === 'sandbox';

    if (isSuccess) {
      payment.status             = 'completed';
      payment.liqpayTransactionId = payload.transaction_id;
      await payment.save();

      const order = await Order.findById(payment.orderId);
      if (order && order.status === 'open') {
        // Move to open_paid (not completed_epay) so the kitchen keeps working
        // until all dishes are served. maybeFinalizeOpenPaidOrder() will
        // transition to completed_epay once every dish is marked served.
        order.status        = 'open_paid';
        order.paymentMethod = 'epay';
        order.liqpayData    = { transactionId: payload.transaction_id, amount: payment.amount, paymentDate: new Date() };
        await order.save();

        try {
          const items = await require('../models/OrderItem').find({ orderId: order._id }).lean();
          await auditService.log({
            restaurantId: order.restaurantId,
            eventType:    'EPAY_PAYMENT',
            orderId:      order._id,
            tableId:      order.tableId,
            amount:       payment.amount,
            paymentMethod: 'ONLINE',
            transactionId: payload.transaction_id,
            receipt:      auditService.buildReceipt(items),
            meta: { sessionToken: order.sessionToken, ipAddress: req.ip },
          });
        } catch (e) { logger.error('paymentWebhook: auditService.log failed', { error: e?.message }); }

        const completedAt = new Date();
        emit(`session:${order.sessionToken}`, 'PAYMENT_COMPLETED', { orderId: order._id, method: 'epay', amount: payment.amount, completedAt });
        emit(`table:${order.tableId}`,        'PAYMENT_COMPLETED', { orderId: order._id, method: 'epay', amount: payment.amount, completedAt });
        emit(`waiter:${order.restaurantId}`,  'PAYMENT_COMPLETED', { orderId: order._id, method: 'epay', amount: payment.amount, completedAt });
        emit(`kitchen:${order.restaurantId}`, 'PAYMENT_COMPLETED', { orderId: order._id, method: 'epay', amount: payment.amount, completedAt });

        try {
          await createNotification({ orderId: order._id, restaurantId: order.restaurantId, sessionToken: order.sessionToken, tableId: order.tableId, type: 'payment_completed_epay', data: { amount: payment.amount } });
        } catch (e) { logger.error('paymentWebhook: createNotification failed', { error: e?.message }); }

        // Auto-finalize immediately if all dishes are already served
        try {
          const { maybeFinalizeOpenPaidOrder } = require('../services/orderService');
          await maybeFinalizeOpenPaidOrder(order._id);
        } catch (e) { logger.error('paymentWebhook: maybeFinalizeOpenPaidOrder failed', { error: e?.message }); }
      }
    } else if (['failure', 'error'].includes(payload.status)) {
      payment.status = 'failed';
      await payment.save();

      const order = await Order.findById(payment.orderId);
      if (order) {
        emit(`session:${order.sessionToken}`, 'PAYMENT_FAILED', { orderId: order._id, reason: payload.err_description });
        emit(`table:${order.tableId}`,        'PAYMENT_FAILED', { orderId: order._id, reason: payload.err_description });
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error('payment_webhook_error', { error: err.message });
    res.status(200).send('OK');
  }
});

module.exports = router;
