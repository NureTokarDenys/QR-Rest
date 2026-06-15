const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const passport = require('passport');

const requestId = require('./middleware/requestId');
const httpLogger = require('./middleware/httpLogger');
const errorHandler = require('./middleware/errorHandler');
const { globalRateLimiter } = require('./middleware/rateLimiter');
require('./config/passport');

const routes = require('./routes');
const paymentWebhookRouter      = require('./routes/paymentWebhook');
const subscriptionWebhookRouter = require('./routes/subscriptionWebhook');

const app = express();

app.use(helmet());
// When CORS_ORIGIN is set use that exact origin; otherwise reflect the request
// origin back. Reflecting is required so that withCredentials requests (cookies)
// work between the dev frontend (localhost:3000) and the API (localhost:5000).
// Note: origin:true is intentionally more permissive for local dev — set
// CORS_ORIGIN=https://yourdomain.com in production.
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(passport.initialize());

app.use(requestId);
app.use(httpLogger);
app.use(globalRateLimiter);

// LiqPay webhooks at fixed paths (no /v1 prefix per spec)
app.use('/api/payments/webhook',      paymentWebhookRouter);
app.use('/api/subscriptions/webhook', subscriptionWebhookRouter);

// Main API
app.use('/api', routes);

app.use(errorHandler);

module.exports = app;
