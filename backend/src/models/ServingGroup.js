const mongoose = require('mongoose');

const servingGroupSchema = new mongoose.Schema(
  {
    orderId:         { type: String, ref: 'Order', required: true },
    name:            { type: String, required: true, trim: true },
    sortOrder:       { type: Number, default: 0 },
    statusChangedAt: { type: Date, default: null },
    wasRolledBack:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServingGroup', servingGroupSchema);
