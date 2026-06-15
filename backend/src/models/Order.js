const mongoose = require('mongoose');

// open_paid: payment received (cash or epay) but kitchen may still be working.
// Kitchen continues showing the order; table stays occupied until waiter closes it.
// On table close, open_paid transitions to completed_cash or completed_epay based on paymentMethod.
const ORDER_STATUSES = ['open', 'open_paid', 'cancelled', 'completed_cash', 'completed_epay'];

const orderSchema = new mongoose.Schema(
  {
    _id:          { type: String },           // 8-char alphanumeric, e.g. "K4X9B2MR"
    tableId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Table',      required: true },
    restaurantId: { type: String,                         ref: 'Restaurant', required: true },
    sessionToken: { type: String, required: true },
    status:       { type: String, enum: ORDER_STATUSES, default: 'open' },
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String },
    // Populated when moving to open_paid — determines final status on table close.
    paymentMethod: { type: String, enum: ['cash', 'epay'], default: null },
    liqpayData:   {
      transactionId: { type: String },
      amount:        { type: Number },
      paymentDate:   { type: Date },
    },
  },
  { timestamps: true }
);

orderSchema.index({ tableId: 1, status: 1 });
orderSchema.index({ sessionToken: 1 });
orderSchema.index({ restaurantId: 1, createdAt: 1 });

module.exports = mongoose.model('Order', orderSchema);
