const router = require('express').Router();

// ── Global routes (no restaurant context) ───────────────────────────────
router.use('/health',      require('./health'));
router.use('/auth',        require('./auth'));
router.use('/onboarding',  require('./onboarding'));
router.use('/user',        require('./user'));
router.use('/restaurants', require('./restaurants'));
router.use('/qr',          require('./qr'));

// ── Restaurant-scoped routes (/api/:restaurantId/...) ───────────────────
// Must be registered AFTER all fixed-prefix global routes so that
// paths like /api/auth/... don't accidentally match /:restaurantId.
router.use('/:restaurantId', require('./scoped'));

module.exports = router;
