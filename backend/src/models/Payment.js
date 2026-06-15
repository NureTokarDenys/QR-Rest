const mongoose = require('mongoose');

const PAYMENT_METHODS  = ['cash', 'online'];
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'reverted'];

const paymentSchema = new mongoose.Schema(
  {
    orderId:              { type: String,                         ref: 'Order',       required: true },
    restaurantId:         { type: String,                         ref: 'Restaurant',  required: true },
    amount:               { type: Number, required: true, min: 0 },
    method:               { type: String, enum: PAYMENT_METHODS,  required: true },
    status:               { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    processedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revertedBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revertedAt:           { type: Date },
    liqpayOrderId:        { type: String },
    liqpayTransactionId:  { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
