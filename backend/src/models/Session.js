const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const SESSION_TTL_MS     = 6 * 60 * 60 * 1000;  // 6-hour session lifetime
const RECOVERY_WINDOW_MS = 60 * 1000;             // 1-minute recovery window

const deviceFingerprintSchema = new mongoose.Schema(
  {
    hash:      { type: String, required: true },
    ip:        { type: String },
    userAgent: { type: String },
    joinedAt:  { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    token:        { type: String, default: uuidv4, unique: true },
    tableId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    restaurantId: { type: String, ref: 'Restaurant', required: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + SESSION_TTL_MS),
    },
    isActive: { type: Boolean, default: true },

    // ── Device fingerprints ────────────────────────────────────────────────────
    // One entry per unique device that scanned the QR code.
    joinedFingerprints: { type: [deviceFingerprintSchema], default: [] },

    // ── Anomaly counters ───────────────────────────────────────────────────────
    deviceCount: { type: Number, default: 0 },
    flaggedAt:   { type: Date,   default: null },
    flagReason:  { type: String, default: null },

    // ── Session recovery ───────────────────────────────────────────────────────
    // Waiter opens a 1-minute window; first scan during this window restores
    // the session for a guest who lost their cookie. Second scan is rejected.
    recoveryWindowClosesAt: { type: Date, default: null },
    recoveryClaimedAt:      { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ tableId: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

sessionSchema.statics.RECOVERY_WINDOW_MS = RECOVERY_WINDOW_MS;

module.exports = mongoose.model('Session', sessionSchema);
