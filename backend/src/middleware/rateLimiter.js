const rateLimit = require('express-rate-limit');

const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' },
  },
  keyGenerator: (req) => req.ip,
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: process.env.NODE_ENV === 'production' ? 20 : 1000,
  skip: () => process.env.NODE_ENV !== 'production',
  message: {
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many auth attempts.' },
  },
  keyGenerator: (req) => req.ip,
});

module.exports = { globalRateLimiter, authRateLimiter };
