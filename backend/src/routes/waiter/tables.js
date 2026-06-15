const router = require('express').Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const Table        = require('../../models/Table');
const Order        = require('../../models/Order');
const Session      = require('../../models/Session');
const ServingGroup = require('../../models/ServingGroup');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound, badRequest } = require('../../middleware/validate');
const { invalidateTableSessions, openRecoveryWindow } = require('../../services/sessionService');
const { emit } = require('../../services/wsService');
const { nextPublicId } = require('../../utils/publicId');
const auditService = require('../../services/auditService');

const staffAuth = [requireAuth, requireRole('waiter', 'waiter_cook', 'admin'), requireSameRestaurant];

// POST /:restaurantId/waiter/tables/:tableId/session/recovery
// Staff opens a 1-minute recovery window so a guest who lost their cookie can
// re-scan the QR and have their session restored. Only the FIRST scan during
// the window claims it; subsequent scans are rejected until a new window is opened.
router.post('/:tableId/session/recovery', ...staffAuth, async (req, res, next) => {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId });
    if (!table) return next(notFound('Table not found'));

    const recovery = await openRecoveryWindow(table._id, req.restaurantId);
    if (!recovery) {
      return res.status(409).json({
        error: { code: 'NO_ACTIVE_SESSION', message: 'No active session found for this table. The guest must scan the QR code normally.' },
        meta:  { request_id: req.requestId },
      });
    }

    res.json({
      data: {
        tableId:               table._id,
        tableNumber:           table.number,
        recoveryWindowClosesAt: recovery.recoveryWindowClosesAt,
      },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// POST /:restaurantId/waiter/tables/:tableId/close
router.post('/:tableId/close', ...staffAuth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return next(badRequest('reason is required'));

    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId });
    if (!table) return next(notFound('Table not found'));

    const activeOrders = await Order.find({ tableId: table._id, status: { $nin: ['cancelled', 'completed_cash', 'completed_epay'] } });
    let cancelledCount = 0;
    let completedCount = 0;

    for (const order of activeOrders) {
      if (order.status === 'open_paid') {
        // Already paid — finalize based on payment method instead of cancelling
        order.status = order.paymentMethod === 'epay' ? 'completed_epay' : 'completed_cash';
        await order.save();

        // Already paid — the payment receipt was logged when payment completed,
        // so closing the table is not itself an auditable financial event.

        emit(`session:${order.sessionToken}`, 'ORDER_COMPLETED', { orderId: order._id, status: order.status });
        emit(`kitchen:${req.restaurantId}`,   'ORDER_COMPLETED', { orderId: order._id, status: order.status });
        completedCount++;
      } else {
        order.status       = 'cancelled';
        order.cancelReason = `Столик закрито вручну: ${reason}`;
        await order.save();

        await auditService.log({
          restaurantId: req.restaurantId,
          eventType: 'CANCEL',
          orderId:   order._id,
          tableId:   order.tableId,
          initiatedBy: { userId: req.user._id, role: req.user.role },
          reason:    order.cancelReason,
          meta: { sessionToken: order.sessionToken, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
        });

        emit(`session:${order.sessionToken}`, 'ORDER_CANCELLED', { orderId: order._id, reason: order.cancelReason, cancelledAt: new Date() });
        cancelledCount++;
      }
    }

    table.status = 'free';
    await table.save();
    await invalidateTableSessions(table._id);

    emit(`waiter:${req.restaurantId}`, 'TABLE_STATUS_UPDATED', { tableId: table._id, tableNumber: table.number, status: 'free' });

    res.json({ data: { tableId: table._id, status: 'free', cancelledOrders: cancelledCount, completedOrders: completedCount }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// POST /:restaurantId/waiter/tables/:tableId/order
// Waiter creates an empty order on behalf of a guest at a free table.
// Creates a session (for guest recovery), locks the table, and returns the orderId.
router.post('/:tableId/order', ...staffAuth, async (req, res, next) => {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, restaurantId: req.restaurantId });
    if (!table) return next(notFound('Table not found'));

    if (table.status !== 'free') {
      return res.status(409).json({
        error: { code: 'TABLE_NOT_FREE', message: 'Table is not free' },
        meta: { request_id: req.requestId },
      });
    }

    const existingOrder = await Order.findOne({
      tableId: table._id,
      restaurantId: req.restaurantId,
      status: { $nin: ['cancelled', 'completed_cash', 'completed_epay'] },
    });
    if (existingOrder) {
      return res.status(409).json({
        error: { code: 'TABLE_HAS_ORDER', message: 'Table already has an active order' },
        meta: { request_id: req.requestId },
      });
    }

    const session = await Session.create({
      token:        uuidv4(),
      tableId:      table._id,
      restaurantId: req.restaurantId,
    });

    const publicId = await nextPublicId(Order);
    const order = await Order.create({
      _id:          publicId,
      tableId:      table._id,
      restaurantId: req.restaurantId,
      sessionToken: session.token,
      status:       'open',
    });

    await ServingGroup.create({ orderId: order._id, name: 'Основна подача', sortOrder: 0 });

    table.status = 'occupied';
    await table.save();

    emit(`waiter:${req.restaurantId}`, 'TABLE_STATUS_UPDATED', { tableId: table._id, tableNumber: table.number, status: 'occupied' });
    emit(`waiter:${req.restaurantId}`, 'ORDER_NEW', { orderId: order._id, tableId: table._id, tableNumber: table.number });

    res.status(201).json({
      data: { orderId: order._id, sessionToken: session.token },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

module.exports = router;
