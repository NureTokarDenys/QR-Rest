const crypto = require('crypto');

// In-memory store: nonce → { userId, expiresAt }
// Cleaned every minute; each nonce is single-use and expires in 5 minutes.
const store = new Map();

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}, 60_000);
cleanup.unref?.(); // don't keep the process alive just for cleanup

/**
 * Create a one-time nonce tied to a userId.
 * @param {string} userId
 * @returns {string} nonce (32 hex chars)
 */
function create(userId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  store.set(nonce, { userId: userId.toString(), expiresAt: Date.now() + 5 * 60_000 });
  return nonce;
}

/**
 * Verify and consume a nonce. Returns the userId if valid, null otherwise.
 * @param {string} nonce
 * @returns {string|null}
 */
function consume(nonce) {
  const entry = store.get(nonce);
  if (!entry || entry.expiresAt < Date.now()) return null;
  store.delete(nonce);
  return entry.userId;
}

module.exports = { create, consume };
