const AuditLog = require('../models/AuditLog');

// Build an immutable receipt snapshot from an order's line items.
// Mirrors the price math used when charging (unitPrice + component modifiers,
// plus add-ons, times quantity). subtotal === total here — the system has no
// tax or discount lines, but both are stored so receipts read like real bills.
function buildReceipt(orderItems = [], { paidAt = new Date(), currency = 'UAH' } = {}) {
  const items = orderItems.map((oi) => {
    const compMod     = (oi.componentGroupChoices || []).reduce((s, c) => s + (c.priceModifier || 0), 0);
    const addonsTotal = (oi.addons || []).reduce((s, a) => s + (a.price ?? 0) * (a.quantity ?? 1), 0);
    const lineTotal   = (oi.unitPrice + compMod) * oi.quantity + addonsTotal;

    const modifiers = [
      ...(oi.componentGroupChoices || []).map((c) => ({ name: c.optionName || c.groupName, price: c.priceModifier || 0 })),
      ...(oi.addons || []).map((a) => ({ name: a.name, price: (a.price ?? 0) * (a.quantity ?? 1) })),
    ];

    return {
      name:      oi.menuItemName || '',
      quantity:  oi.quantity,
      unitPrice: oi.unitPrice,
      lineTotal,
      modifiers,
    };
  });

  const total = items.reduce((s, it) => s + it.lineTotal, 0);
  return { items, subtotal: total, total, currency, paidAt };
}

async function log({ restaurantId, eventType, orderId, tableId, initiatedBy, amount, reason, debtAmount, paymentMethod, receipt, transactionId, meta }) {
  return AuditLog.create({
    restaurantId,
    eventType,
    orderId,
    tableId,
    initiatedBy,
    amount,
    reason,
    debtAmount,
    paymentMethod,
    receipt,
    transactionId,
    meta,
  });
}

module.exports = { log, buildReceipt };
