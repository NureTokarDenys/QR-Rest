const mongoose = require('mongoose');

// CASH_PAYMENT — waiter accepts cash for an order
// EPAY_PAYMENT — LiqPay online payment completed
// CANCEL       — order cancelled (normal reason)
const EVENT_TYPES = ['CASH_PAYMENT', 'EPAY_PAYMENT', 'CANCEL'];

// Receipt line item — immutable snapshot of a single dish as it was charged.
const receiptItemSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true },
    quantity:  { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    modifiers: [
      {
        _id:   false,
        name:  { type: String },
        price: { type: Number, default: 0 },
      },
    ],
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    timestamp:    { type: Date,   default: Date.now, immutable: true },
    restaurantId: { type: String, ref: 'Restaurant', required: true, immutable: true },
    eventType:    { type: String, enum: EVENT_TYPES,  required: true, immutable: true },
    orderId:      { type: String, ref: 'Order',       immutable: true },
    tableId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Table', immutable: true },
    initiatedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', immutable: true },
      role:   { type: String, immutable: true },
    },
    amount:        { type: Number, immutable: true },
    reason:        { type: String, immutable: true },
    debtAmount:    { type: Number, immutable: true },
    paymentMethod: { type: String, immutable: true },

    // Receipt snapshot — populated for payment events so each entry doubles as a
    // printable bill (line items + totals frozen at the moment of payment).
    receipt: {
      items:    { type: [receiptItemSchema], immutable: true },
      subtotal: { type: Number, immutable: true },
      total:    { type: Number, immutable: true },
      currency: { type: String, default: 'UAH', immutable: true },
      paidAt:   { type: Date, immutable: true },
    },
    // LiqPay transaction id — present on EPAY_PAYMENT receipts.
    transactionId: { type: String, immutable: true },

    meta: {
      sessionToken: { type: String, immutable: true },
      ipAddress:    { type: String, immutable: true },
      userAgent:    { type: String, immutable: true },
    },
  },
  { timestamps: false, versionKey: false }
);

auditLogSchema.index({ restaurantId: 1, timestamp: -1 });
auditLogSchema.index({ orderId: 1 });

auditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  function () { throw new Error('AuditLog records are immutable'); }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
