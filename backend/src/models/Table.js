const mongoose = require('mongoose');
const crypto = require('crypto');

// free     — no active order at the table
// occupied — table has an active order (open or open_paid)
// disabled — deactivated by admin; QR scanning returns an unavailable page
const TABLE_STATUSES = ['free', 'occupied', 'disabled'];

const tableSchema = new mongoose.Schema(
  {
    number:   { type: Number, required: true },
    label:    { type: String, trim: true },
    capacity: { type: Number, default: 4 },
    status:   { type: String, enum: TABLE_STATUSES, default: 'free' },
    shortCode: {
      type: String,
      unique: true,
      uppercase: true,
      match: /^[A-Z0-9]{4,8}$/,
    },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
    isActive:  { type: Boolean, default: true },
    mapOrder:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

tableSchema.index({ restaurantId: 1, status: 1 });

tableSchema.pre('save', async function () {
  if (!this.shortCode) {
    this.shortCode = generateShortCode();
  }
});

function generateShortCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

module.exports = mongoose.model('Table', tableSchema);
