const crypto     = require('crypto');
const router     = require('express').Router();

const OnboardingRequest = require('../models/OnboardingRequest');
const Restaurant        = require('../models/Restaurant');
const User              = require('../models/User');
const Table             = require('../models/Table');
const { nextPublicId }  = require('../utils/publicId');
const { badRequest }    = require('../middleware/validate');
const {
  sendOnboardingConfirmation,
  sendOnboardingCredentials,
} = require('../services/emailService');

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Generate a URL-safe confirmation token (48 hex chars). */
function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Generate a secure random password.
 * 14 characters — uppercase, lowercase, digits, symbols.
 */
function generatePassword(length = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/**
 * Convert a restaurant name into a URL-friendly slug.
 * Appends a short random suffix to guarantee uniqueness without a DB lookup.
 */
function slugify(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '-')   // keep Cyrillic too
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = crypto.randomBytes(3).toString('hex');   // 6 chars
  return `${base}-${suffix}`;
}

function respond(res, req, data, status = 200) {
  res.status(status).json({ data, meta: { request_id: req.requestId } });
}

// ─── POST /onboarding/register ───────────────────────────────────────────────
// Body: { email, ownerName, restaurantName }
// Creates a pending OnboardingRequest and sends a confirmation email.

router.post('/register', async (req, res, next) => {
  try {
    const { email, ownerName, restaurantName } = req.body;

    if (!email || !ownerName || !restaurantName) {
      return next(badRequest('email, ownerName and restaurantName are required'));
    }

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) return next(badRequest('Invalid email address'));
    if (ownerName.trim().length < 2) return next(badRequest('ownerName must be at least 2 characters'));
    if (restaurantName.trim().length < 2) return next(badRequest('restaurantName must be at least 2 characters'));

    // Block duplicate active requests for the same email
    const existing = await OnboardingRequest.findOne({
      email: email.toLowerCase().trim(),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
    if (existing) {
      return res.status(409).json({
        error: { code: 'ONBOARDING_PENDING', message: 'A confirmation email was already sent to this address. Please check your inbox.' },
        meta: { request_id: req.requestId },
      });
    }

    // Also block if the email is already a registered user
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'This email is already registered in the system.' },
        meta: { request_id: req.requestId },
      });
    }

    const token     = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    const request = await OnboardingRequest.create({
      email: email.toLowerCase().trim(),
      ownerName: ownerName.trim(),
      restaurantName: restaurantName.trim(),
      token,
      expiresAt,
    });

    const BASE_FRONTEND = process.env.FRONTEND_URL || process.env.BASE_URL?.replace(':5000', ':3000') || 'http://localhost:3000';
    const confirmUrl = `${BASE_FRONTEND}/onboarding/confirm?token=${token}`;

    try {
      await sendOnboardingConfirmation({
        to: email,
        ownerName: ownerName.trim(),
        restaurantName: restaurantName.trim(),
        confirmUrl,
      });
    } catch (emailErr) {
      await OnboardingRequest.deleteOne({ _id: request._id });
      throw emailErr;
    }

    respond(res, req, {
      message: 'Confirmation email sent. Please check your inbox and click the link within 24 hours.',
    }, 201);
  } catch (err) { next(err); }
});

// ─── GET /onboarding/confirm/:token ──────────────────────────────────────────
// Called when the owner clicks the link in the confirmation email.
// Creates the restaurant, admin user, and sends credentials by email.

router.get('/confirm/:token', async (req, res, next) => {
  try {
    const request = await OnboardingRequest.findOne({ token: req.params.token });

    if (!request) {
      return res.status(404).json({
        error: { code: 'INVALID_TOKEN', message: 'Confirmation link is invalid.' },
        meta: { request_id: req.requestId },
      });
    }
    if (request.status === 'confirmed') {
      return res.status(409).json({
        error: { code: 'ALREADY_CONFIRMED', message: 'This link has already been used.' },
        meta: { request_id: req.requestId },
      });
    }
    if (request.status === 'expired' || request.expiresAt < new Date()) {
      request.status = 'expired';
      await request.save();
      return res.status(410).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Confirmation link has expired. Please register again.' },
        meta: { request_id: req.requestId },
      });
    }

    // ── Mark confirmed before creating resources (idempotency guard) ──────
    request.status = 'confirmed';
    await request.save();

    // ── Create Restaurant ─────────────────────────────────────────────────
    const restaurantId = await nextPublicId(Restaurant);
    const restaurant   = await Restaurant.create({
      _id:    restaurantId,
      name:   request.restaurantName,
      slug:   slugify(request.restaurantName),
    });

    // ── Seed 5 default tables ─────────────────────────────────────────────
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        Table.create({ number: i + 1, restaurantId, status: 'free' })
      )
    );

    // ── Create admin User ─────────────────────────────────────────────────
    const password     = generatePassword();
    const passwordHash = await User.hashPassword(password);

    await User.create({
      name:         request.ownerName,
      email:        request.email,
      passwordHash,
      role:         'admin',
      restaurantId,
    });

    // ── Send credentials email ────────────────────────────────────────────
    const loginUrl = `${process.env.BASE_URL?.replace(':5000', ':3000') || 'http://localhost:3000'}/login`;

    await sendOnboardingCredentials({
      to:             request.email,
      ownerName:      request.ownerName,
      restaurantName: restaurant.name,
      restaurantId,
      password,
      loginUrl,
    });

    respond(res, req, {
      message:        'Email confirmed. Your restaurant has been created and admin credentials have been sent to your email.',
      restaurantId,
      restaurantName: restaurant.name,
    });
  } catch (err) { next(err); }
});

module.exports = router;
