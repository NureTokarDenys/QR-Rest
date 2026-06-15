const router  = require('express').Router();
const crypto  = require('crypto');
const passport = require('passport');
const User          = require('../models/User');
const PasswordReset        = require('../models/PasswordReset');
const EmailChangeRequest   = require('../models/EmailChangeRequest');
const { TokenBlacklist }   = require('../models/TokenBlacklist');
const { signAccess, signRefresh, verifyRefresh } = require('../config/jwt');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { badRequest } = require('../middleware/validate');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { sendPasswordReset, sendEmailChangeConfirmation } = require('../services/emailService');
const jwt = require('jsonwebtoken');

function tokenPayload(user) {
  return { sub: user._id, role: user.role, restaurantId: user.restaurantId };
}

function respond(res, req, data) {
  res.json({ data, meta: { request_id: req.requestId } });
}

/** Builds a consistent public user shape including computed boolean flags. */
function userShape(user) {
  return {
    id:            user._id,
    name:          user.name,
    email:         user.email,
    role:          user.role,
    restaurantId:  user.restaurantId ?? null,
    hasGoogle:     Boolean(user.googleId),
    hasPassword:   Boolean(user.passwordHash),
    googleEmail:   user.googleEmail   ?? null,
    googleName:    user.googleName    ?? null,
    googlePicture: user.googlePicture ?? null,
  };
}

// POST /auth/register
router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return next(badRequest('email, password and name are required'));
    if (password.length < 8) return next(badRequest('Password must be at least 8 characters'));

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' }, meta: { request_id: req.requestId } });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role: 'guest' });

    const access = signAccess(tokenPayload(user));
    const refresh = signRefresh(tokenPayload(user));
    respond(res, req, { accessToken: access, refreshToken: refresh, user: userShape(user) });
  } catch (err) { next(err); }
});

// POST /auth/login
router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(badRequest('email and password are required'));

    const user = await User.findOne({ email }).select('+passwordHash +loginAttempts +lockUntil');
    if (!user) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }, meta: { request_id: req.requestId } });

    if (user.isLocked()) {
      return res.status(423).json({ error: { code: 'ACCOUNT_LOCKED', message: 'Account locked for 15 minutes due to too many failed attempts' }, meta: { request_id: req.requestId } });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }, meta: { request_id: req.requestId } });
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    const access = signAccess(tokenPayload(user));
    const refresh = signRefresh(tokenPayload(user));
    respond(res, req, { accessToken: access, refreshToken: refresh, user: userShape(user) });
  } catch (err) { next(err); }
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    // Re-fetch with +passwordHash so hasPassword is accurate
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' }, meta: { request_id: req.requestId } });
    respond(res, req, userShape(user));
  } catch (err) { next(err); }
});

// PATCH /auth/me — update name only (email change requires confirmation flow)
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return next(badRequest('name is required'));
    if (name.trim().length < 2) return next(badRequest('Name must be at least 2 characters'));

    const user = await User.findById(req.user._id).select('+passwordHash');
    user.name = name.trim();
    await user.save();

    respond(res, req, userShape(user));
  } catch (err) { next(err); }
});

// POST /auth/change-email-request — send confirmation to the new email address
router.post('/change-email-request', requireAuth, async (req, res, next) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return next(badRequest('newEmail is required'));
    const normalised = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) return next(badRequest('Invalid email address'));

    const taken = await User.findOne({ email: normalised });
    if (taken) return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'This email is already in use' }, meta: { request_id: req.requestId } });

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await EmailChangeRequest.deleteMany({ userId: req.user._id });
    await EmailChangeRequest.create({ userId: req.user._id, newEmail: normalised, tokenHash, expiresAt });

    const appUrl     = process.env.APP_URL || 'http://localhost:5173';
    const confirmUrl = `${appUrl}/confirm-email-change?token=${rawToken}`;

    sendEmailChangeConfirmation({ to: normalised, name: req.user.name, newEmail: normalised, confirmUrl })
      .catch(err => console.error('Failed to send email-change confirmation:', err));

    respond(res, req, { message: 'Confirmation email sent to the new address.' });
  } catch (err) { next(err); }
});

// GET /auth/confirm-email-change?token=xxx — activate the new email
router.get('/confirm-email-change', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return next(badRequest('token is required'));

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record    = await EmailChangeRequest.findOne({ tokenHash, usedAt: null });

    if (!record) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired confirmation link' }, meta: { request_id: req.requestId } });
    }
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ error: { code: 'TOKEN_EXPIRED', message: 'Confirmation link has expired. Please request a new one.' }, meta: { request_id: req.requestId } });
    }

    const taken = await User.findOne({ email: record.newEmail });
    if (taken && String(taken._id) !== String(record.userId)) {
      return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'This email was taken by another account in the meantime.' }, meta: { request_id: req.requestId } });
    }

    const user = await User.findById(record.userId);
    if (!user) return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Account not found' }, meta: { request_id: req.requestId } });

    user.email = record.newEmail;
    await user.save();

    record.usedAt = new Date();
    await record.save();

    respond(res, req, { message: 'Email updated successfully', email: user.email });
  } catch (err) { next(err); }
});

// DELETE /auth/account — permanently delete a guest account
router.delete('/account', requireAuth, requireRole('guest'), async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    await PasswordReset.deleteMany({ userId: req.user._id });
    await EmailChangeRequest.deleteMany({ userId: req.user._id });
    res.clearCookie('session_token');
    respond(res, req, { message: 'Account deleted' });
  } catch (err) { next(err); }
});

// POST /auth/change-password — requires the current password (accounts that already have one)
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return next(badRequest('currentPassword and newPassword are required'));
    if (newPassword.length < 8) return next(badRequest('New password must be at least 8 characters'));

    const user = await User.findById(req.user._id).select('+passwordHash');
    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(400).json({ error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' }, meta: { request_id: req.requestId } });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();
    respond(res, req, { message: 'Password changed' });
  } catch (err) { next(err); }
});

// POST /auth/set-password — first-time password setup for Google-only accounts (no current password)
router.post('/set-password', requireAuth, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return next(badRequest('newPassword is required'));
    if (newPassword.length < 8) return next(badRequest('Password must be at least 8 characters'));

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (user.passwordHash) {
      // Account already has a password — use change-password instead
      return res.status(400).json({ error: { code: 'PASSWORD_ALREADY_SET', message: 'Account already has a password. Use change-password instead.' }, meta: { request_id: req.requestId } });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();
    respond(res, req, userShape(user));
  } catch (err) { next(err); }
});

// POST /auth/forgot-password
// Always returns 200 regardless of whether the email exists (prevents enumeration).
router.post('/forgot-password', authRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(badRequest('email is required'));

    const user = await User.findOne({ email });
    if (user) {
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // One active reset per user at a time
      await PasswordReset.deleteMany({ userId: user._id });
      await PasswordReset.create({ userId: user._id, tokenHash, expiresAt });

      const appUrl   = process.env.APP_URL || 'http://localhost:5173';
      const resetUrl = `${appUrl}/forgot-password?token=${rawToken}`;

      sendPasswordReset({ to: email, name: user.name, resetUrl }).catch(err => {
        console.error('Failed to send password reset email:', err);
      });
    }

    respond(res, req, { message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) { next(err); }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return next(badRequest('token and newPassword are required'));
    if (newPassword.length < 8) return next(badRequest('Password must be at least 8 characters'));

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record    = await PasswordReset.findOne({ tokenHash, usedAt: null });

    if (!record) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset link' }, meta: { request_id: req.requestId } });
    }
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ error: { code: 'TOKEN_EXPIRED', message: 'Reset link has expired. Please request a new one.' }, meta: { request_id: req.requestId } });
    }

    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid reset link' }, meta: { request_id: req.requestId } });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    record.usedAt = new Date();
    await record.save();

    respond(res, req, { message: 'Password reset successfully' });
  } catch (err) { next(err); }
});

// POST /auth/logout
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 3600_000);
      await TokenBlacklist.create({ token, expiresAt });
    }
    res.clearCookie('session_token');
    respond(res, req, { message: 'Logged out' });
  } catch (err) { next(err); }
});

// POST /auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(badRequest('refreshToken is required'));

    const payload = verifyRefresh(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' }, meta: { request_id: req.requestId } });

    const access = signAccess(tokenPayload(user));
    respond(res, req, { accessToken: access });
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' }, meta: { request_id: req.requestId } });
  }
});

const linkNonces = require('../services/linkNonceService');

const FRONTEND = () => process.env.FRONTEND_URL || 'http://localhost:5173';

// GET /auth/google — initiate OAuth (login OR link flow)
// ?link=1 is appended by the frontend only when coming from prepare-link.
// Without it we treat this as a plain login and clear any stale link cookie so
// a leftover nonce from a previous link attempt never hijacks the login flow.
router.get('/google', (req, res, next) => {
  if (!req.query.link) {
    res.clearCookie('google_link_nonce', { httpOnly: true, sameSite: 'lax' });
  }
  passport.authenticate('google', {
    scope:  ['profile', 'email'],
    prompt: 'select_account',   // always show the account picker
  })(req, res, next);
});

// POST /auth/google/prepare-link — authenticated users call this to get a
// one-time nonce cookie before being redirected to Google for account linking.
router.post('/google/prepare-link', requireAuth, (req, res) => {
  const nonce = linkNonces.create(req.user._id);
  // httpOnly + sameSite:lax so the cookie survives the OAuth top-level redirect
  res.cookie('google_link_nonce', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   5 * 60 * 1000, // 5 minutes
  });
  respond(res, req, { ok: true });
});

// GET /auth/google/callback
// Uses a custom Passport callback so we can forward the specific error code
// (GOOGLE_ALREADY_LINKED, LINK_EXPIRED …) to the frontend instead of a
// generic failureRedirect.
router.get('/google/callback', (req, res, next) => {
  const isLink = Boolean(req.cookies?.google_link_nonce);

  passport.authenticate('google', { session: false }, async (err, user) => {
    // Always clear the link cookie on every outcome
    res.clearCookie('google_link_nonce', { httpOnly: true, sameSite: 'lax' });

    if (err) return next(err);

    const STAFF_ROLES = ['admin', 'root_admin', 'waiter', 'cook', 'waiter_cook'];

    if (!user) {
      // Authentication or link failed — forward the specific error code so the
      // frontend can show a meaningful message.
      if (isLink) {
        const code = req._googleLinkError || 'LINK_FAILED';
        const linkUser = req._googleLinkUser;
        const dest = linkUser && STAFF_ROLES.includes(linkUser.role) ? '/staff/settings' : '/profile';
        return res.redirect(`${FRONTEND()}${dest}?oauthError=${code}`);
      }
      return res.redirect(`${FRONTEND()}/login?oauthError=OAUTH_FAILED`);
    }

    // ── Link success ───────────────────────────────────────────────────────
    if (req._googleLinked) {
      const dest = STAFF_ROLES.includes(user.role) ? '/staff/settings' : '/profile';
      return res.redirect(`${FRONTEND()}${dest}?googleLinked=1`);
    }

    // ── Login / auto-register success ──────────────────────────────────────
    // Re-fetch with +passwordHash so hasPassword is accurate.
    try {
      const freshUser = await User.findById(user._id).select('+passwordHash');
      const access  = signAccess(tokenPayload(freshUser));
      const refresh = signRefresh(tokenPayload(freshUser));
      const params  = new URLSearchParams({
        accessToken:  access,
        refreshToken: refresh,
        user:         JSON.stringify(userShape(freshUser)),
      });
      res.redirect(`${FRONTEND()}/auth/callback?${params.toString()}`);
    } catch (e) { next(e); }
  })(req, res, next);
});

// POST /auth/google/link
router.post('/google/link', requireAuth, requireRole('guest'), async (req, res, next) => {
  try {
    const { googleCode } = req.body;
    if (!googleCode) return next(badRequest('googleCode is required'));
    respond(res, req, { message: 'Google account linked' });
  } catch (err) { next(err); }
});

// DELETE /auth/google/unlink
router.delete('/google/unlink', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user.passwordHash) return next(badRequest('Set a password before unlinking Google'));
    user.googleId = undefined;
    await user.save();
    respond(res, req, { message: 'Google account unlinked' });
  } catch (err) { next(err); }
});

// POST /auth/set-password
router.post('/set-password', requireAuth, requireRole('guest'), async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) return next(badRequest('Password must be at least 8 characters'));
    const user = await User.findById(req.user._id);
    user.passwordHash = await User.hashPassword(password);
    await user.save();
    respond(res, req, { message: 'Password set successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
