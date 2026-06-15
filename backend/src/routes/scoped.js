/**
 * Restaurant-scoped sub-router.
 * Mounted at /api/:restaurantId — the :restaurantId param is the 8-digit publicId.
 * restaurantParam middleware resolves it to a MongoDB ObjectId on req.restaurantId.
 */
const router = require('express').Router({ mergeParams: true });
const { restaurantParam } = require('../middleware/restaurantParam');

// Always resolve the restaurant first
router.use(restaurantParam);

// ── Public restaurant info ───────────────────────────────────────────────
router.get('/info', (req, res) => {
  const r = req.restaurant;
  res.json({
    publicId:         r._id,
    name:             r.name             || '',
    name_en:          r.name_en          || r.translations?.name?.en || r.name || '',
    defaultLanguage:  r.defaultLanguage  || 'uk',
    enabledLanguages: r.enabledLanguages || ['uk'],
    plan:             r.plan             || 'free',
  });
});

// ── Public / session-based ──────────────────────────────────────────────
router.use('/menu',          require('./menu'));
router.use('/orders',        require('./orders'));
router.use('/notifications', require('./notifications'));
router.use('/payments',       require('./payments'));
router.use('/subscriptions',  require('./subscriptions'));
router.use('/reviews',       require('./reviews'));

// ── Staff ───────────────────────────────────────────────────────────────
router.use('/admin/tables',    require('./admin/tables'));
router.use('/admin/menu',      require('./admin/menu'));
router.use('/admin/analytics', require('./admin/analytics'));
router.use('/admin/staff',     require('./admin/staff'));
router.use('/admin/restaurant',require('./admin/restaurant'));
router.use('/admin/reviews',   require('./admin/reviews'));
router.use('/admin/audit-log',    require('./admin/auditLog'));
router.use('/admin/translate',    require('./admin/translate'));
router.use('/admin/translations', require('./admin/translations'));

router.use('/waiter/orders', require('./waiter/orders'));
router.use('/waiter/calls',  require('./waiter/calls'));
router.use('/waiter/tables', require('./waiter/tables'));

router.use('/kitchen/orders',   require('./kitchen/orders'));
router.use('/kitchen/stoplist', require('./kitchen/stoplist'));
router.use('/kitchen/extras',   require('./kitchen/extras'));

module.exports = router;
