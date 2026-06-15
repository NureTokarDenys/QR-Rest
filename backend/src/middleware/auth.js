const passport = require('passport');
const Session = require('../models/Session');

function requireAuth(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        meta: { request_id: req.requestId },
      });
    }
    req.user = user;
    next();
  })(req, res, next);
}

function optionalAuth(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) req.user = user;
    next();
  })(req, res, next);
}

async function requireSession(req, res, next) {
  const token = req.cookies?.session_token || req.headers['x-session-token'];
  if (!token) {
    return res.status(401).json({
      error: { code: 'SESSION_REQUIRED', message: 'Session token required' },
      meta: { request_id: req.requestId },
    });
  }
  const session = await Session.findOne({ token, isActive: true });
  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({
      error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' },
      meta: { request_id: req.requestId },
    });
  }
  req.session = session;
  next();
}

module.exports = { requireAuth, optionalAuth, requireSession };
