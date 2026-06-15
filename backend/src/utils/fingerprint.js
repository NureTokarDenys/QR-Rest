const crypto = require('crypto');

/**
 * Derives a stable device fingerprint from an incoming HTTP request.
 *
 * We intentionally avoid using the full IP address so guests on the same
 * Wi-Fi with dynamic IPs (or mobile networks with NAT) still match.
 * Using the first two octets (/16 prefix) keeps it permissive enough for
 * a restaurant environment while still blocking remote attackers whose
 * IP differs at a higher level.
 *
 * Hash inputs:
 *   - IP /16 prefix  (e.g. "192.168" from "192.168.1.42")
 *   - User-Agent     (browser / device identifier)
 *   - Accept-Language (locale, adds entropy)
 *
 * @param {import('express').Request} req
 * @returns {{ hash: string, ip: string, userAgent: string }}
 */
function deviceFingerprint(req) {
  const rawIp    = (req.ip || req.connection?.remoteAddress || '').replace('::ffff:', '');
  const ipPrefix = rawIp.split('.').slice(0, 2).join('.');   // first two octets
  const ua       = req.headers['user-agent']       || '';
  const lang     = req.headers['accept-language']  || '';

  const hash = crypto
    .createHash('sha256')
    .update(`${ipPrefix}:${ua}:${lang}`)
    .digest('hex');

  return { hash, ip: rawIp, userAgent: ua };
}

/**
 * Returns true when the request's fingerprint matches any entry stored
 * in the session's joinedFingerprints list.
 *
 * An empty list means fingerprint enforcement is disabled (legacy / dev).
 *
 * @param {import('express').Request} req
 * @param {import('../models/Session').default} session  Mongoose document
 */
function fingerprintMatches(req, session) {
  if (!session.joinedFingerprints?.length) return true; // not enforced
  const { hash } = deviceFingerprint(req);
  return session.joinedFingerprints.some(fp => fp.hash === hash);
}

module.exports = { deviceFingerprint, fingerprintMatches };
