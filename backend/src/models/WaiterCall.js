const mongoose = require('mongoose');

// active   — call placed by guest, waiter has not yet responded; blocks new calls from same table
// resolved — waiter acknowledged on their device; table can now place another call of any type
const CALL_STATUSES = ['active', 'resolved'];

// call          — general assistance request (help, question, etc.)
// cash_payment  — guest wants to pay the bill in cash; resolving auto-sets order to open_paid
const CALL_TYPES = ['call', 'cash_payment'];

const waiterCallSchema = new mongoose.Schema(
  {
    tableId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Table',      required: true },
    restaurantId: { type: String,                         ref: 'Restaurant', required: true },
    orderId:      { type: String,                         ref: 'Order' },
    sessionToken: { type: String, required: true },
    type:         { type: String, enum: CALL_TYPES,    default: 'call' },
    status:       { type: String, enum: CALL_STATUSES, default: 'active' },
    resolvedAt:   { type: Date },
    resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

waiterCallSchema.index({ restaurantId: 1, status: 1 });
waiterCallSchema.index({ tableId: 1, status: 1 });

module.exports = mongoose.model('WaiterCall', waiterCallSchema);
