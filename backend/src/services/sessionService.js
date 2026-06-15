const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');

const RECOVERY_WINDOW_MS  = Session.RECOVERY_WINDOW_MS; // 1 min
const MAX_DEVICES_WARNING = 6;

/**
 * Guest scans the QR code.
 *
 * Sessions are created automatically on first scan — no staff action required.
 * Any device can join at any time while the session is active and not expired.
 *
 * Recovery handling: if the waiter opened a recovery window and it is still
 * active + unclaimed, the first scan claims it (cookie is re-issued by the
 * caller); a second scan during the window returns SESSION_RECOVERY_CLAIMED.
 *
 * The `isRecovery` flag on the return value tells the caller that the existing
 * session token should be sent back (rather than a new one being created).
 *
 * Error codes (returned in the `error` field, never thrown):
 *   SESSION_CLOSED         — staff closed the table (session invalidated)
 *   SESSION_RECOVERY_CLAIMED — recovery window already used by someone else
 *
 * @param {{ _id: ObjectId, restaurantId: string }} table
 * @param {{ hash: string, ip: string, userAgent: string }} fingerprint
 * @param {string|null} existingSessionToken — from request cookie, may be null
 * @returns {Promise<{ session?: object, isNew?: boolean, isRecovery?: boolean, error?: string }>}
 */
async function joinSession(table, fingerprint, existingSessionToken = null) {
  let session = await Session.findOne({
    tableId:      table._id,
    restaurantId: table.restaurantId,
    isActive:     true,
    expiresAt:    { $gt: new Date() },
  });

  // No active session → create one automatically (no staff gate)
  if (!session) {
    session = new Session({
      token:        uuidv4(),
      tableId:      table._id,
      restaurantId: table.restaurantId,
    });
    session.joinedFingerprints.push(fingerprint);
    session.deviceCount = 1;
    await session.save();
    return { session, isNew: true };
  }

  // Session closed by staff
  if (!session.isActive) {
    return { error: 'SESSION_CLOSED' };
  }

  // Guest already has the correct session cookie — just refresh it
  if (existingSessionToken && existingSessionToken === session.token) {
    return { session, isNew: false };
  }

  // ── Recovery window logic ──────────────────────────────────────────────────
  const recoveryOpen = session.recoveryWindowClosesAt && new Date() < session.recoveryWindowClosesAt;

  if (recoveryOpen) {
    if (session.recoveryClaimedAt) {
      // Window already used by the first scanner
      return { error: 'SESSION_RECOVERY_CLAIMED' };
    }
    // First scan during recovery — hand the existing session token back
    session.recoveryClaimedAt = new Date();
    await session.save();
    return { session, isNew: false, isRecovery: true };
  }

  // ── Normal scan — register device fingerprint ──────────────────────────────
  const alreadyJoined = session.joinedFingerprints.some(fp => fp.hash === fingerprint.hash);
  const isNew         = !alreadyJoined;

  if (isNew) {
    session.joinedFingerprints.push(fingerprint);
    session.deviceCount += 1;

    if (session.deviceCount > MAX_DEVICES_WARNING && !session.flaggedAt) {
      session.flaggedAt  = new Date();
      session.flagReason = `Excessive devices: ${session.deviceCount}`;
    }

    await session.save();
  }

  return { session, isNew };
}

/**
 * Opens a 1-minute recovery window on the table's active session.
 * Resets any previously claimed window so it can be used again.
 *
 * @param {ObjectId} tableId
 * @param {string} restaurantId
 * @returns {Promise<{ recoveryWindowClosesAt: Date } | null>} null if no active session
 */
async function openRecoveryWindow(tableId, restaurantId) {
  const session = await Session.findOne({
    tableId,
    restaurantId,
    isActive:  true,
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  session.recoveryWindowClosesAt = new Date(Date.now() + RECOVERY_WINDOW_MS);
  session.recoveryClaimedAt      = null; // reset so a new recovery can be claimed
  await session.save();

  return { recoveryWindowClosesAt: session.recoveryWindowClosesAt };
}

/**
 * Invalidates all active sessions for a table (called on table close/reset).
 */
async function invalidateTableSessions(tableId) {
  await Session.updateMany({ tableId, isActive: true }, { isActive: false });
}

module.exports = { joinSession, openRecoveryWindow, invalidateTableSessions };
