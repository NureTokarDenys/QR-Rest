'use strict';
const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt:    { type: Date, default: null },
}, { timestamps: true });

// Auto-purge documents 2 hours after their expiry (keeps collection clean)
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7200 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
