'use strict';
const mongoose = require('mongoose');

const emailChangeRequestSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  newEmail:  { type: String, required: true, lowercase: true, trim: true },
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt:    { type: Date, default: null },
}, { timestamps: true });

// Auto-purge 2 hours after expiry
emailChangeRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7200 });

module.exports = mongoose.model('EmailChangeRequest', emailChangeRequestSchema);
