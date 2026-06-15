const Order      = require('../models/Order');
const OrderItem  = require('../models/OrderItem');
const Table      = require('../models/Table');
const { emit }   = require('./wsService');

// no-op: kept for call-site compatibility
async function recalcOrderStatus(orderId) {}

// Recompute table status after an order event.
// Waiter calls are tracked separately in WaiterCall and do NOT affect table status.
// Table statuses: free | occupied | disabled
// occupied = any order with status 'open' or 'open_paid'
async function recalcTableStatus(tableId) {
  const table = await Table.findById(tableId);
  if (!table || table.status === 'disabled') return;

  const activeCount = await Order.countDocuments({
    tableId,
    status: { $in: ['open', 'open_paid'] },
  });

  const newStatus = activeCount > 0 ? 'occupied' : 'free';

  if (table.status !== newStatus) {
    table.status = newStatus;
    await table.save();

    emit(`waiter:${table.restaurantId}`, 'TABLE_STATUS_UPDATED', {
      tableId:     table._id,
      tableNumber: table.number,
      status:      newStatus,
    });

    if (newStatus === 'free') {
      const { invalidateTableSessions } = require('./sessionService');
      await invalidateTableSessions(tableId);
    }
  }
}

/**
 * Auto-finalize an `open_paid` order once every dish reaches 'served'.
 *
 * The flow:
 *   guest pays in advance → order goes to `open_paid` (kitchen still works).
 *   When the kitchen marks the last dish as served, we transition the order
 *   to its terminal state (completed_cash / completed_epay based on the
 *   stored paymentMethod) and free the table — no waiter action required.
 *
 * Returns the new order status if a transition happened, otherwise null.
 */
async function maybeFinalizeOpenPaidOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== 'open_paid') return null;

  const items = await OrderItem.find({ orderId: order._id }).select('dishStatus').lean();
  if (!items.length) return null;
  if (!items.every(i => i.dishStatus === 'served')) return null;

  const newStatus = order.paymentMethod === 'epay' ? 'completed_epay' : 'completed_cash';
  order.status = newStatus;
  await order.save();

  emit(`session:${order.sessionToken}`, 'ORDER_COMPLETED', { orderId: order._id, status: newStatus });
  emit(`table:${order.tableId}`,        'ORDER_COMPLETED', { orderId: order._id, status: newStatus });
  emit(`kitchen:${order.restaurantId}`, 'ORDER_COMPLETED', { orderId: order._id, status: newStatus });
  emit(`waiter:${order.restaurantId}`,  'ORDER_COMPLETED', { orderId: order._id, status: newStatus });

  await recalcTableStatus(order.tableId);

  return newStatus;
}

module.exports = { recalcOrderStatus, recalcTableStatus, maybeFinalizeOpenPaidOrder };
