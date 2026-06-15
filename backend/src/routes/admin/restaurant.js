const router  = require('express').Router({ mergeParams: true });
const multer   = require('multer');
const Restaurant = require('../../models/Restaurant');
const { requireAuth }           = require('../../middleware/auth');
const { requireRole }           = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound, badRequest }  = require('../../middleware/validate');
const { uploadImage, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } = require('../../config/aws');
const { scheduleAutoTranslate }            = require('../../services/translationService');
const { LANGUAGES }                        = require('../../config/i18n');
const { setTranslationEntry }              = require('../../utils/translatedField');
const { encrypt, decrypt }                 = require('../../services/encryptionService');
const { emit }                             = require('../../services/wsService');
const { createLiqpayService }              = require('../../services/liqpayService');

const adminAuth = [requireAuth, requireRole('admin'), requireSameRestaurant];
const staffAuth = [requireAuth, requireRole('admin', 'waiter', 'cook', 'waiter_cook'), requireSameRestaurant];
const upload    = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

const TRANSLATABLE = ['name', 'address', 'cuisine'];

async function resolveInputLang(req) {
  if (req.body.lang && LANGUAGES.includes(req.body.lang)) return req.body.lang;
  const r = await Restaurant.findById(req.restaurantId).lean();
  return (r?.defaultLanguage && LANGUAGES.includes(r.defaultLanguage)) ? r.defaultLanguage : 'uk';
}

router.get('/', ...staffAuth, async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.restaurantId).lean();
    if (!restaurant) return next(notFound('Restaurant not found'));
    res.json({ data: restaurant, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/', ...adminAuth, async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.restaurantId);
    if (!restaurant) return next(notFound('Restaurant not found'));

    const lang           = await resolveInputLang(req);
    const isSourceLang   = lang === (restaurant.defaultLanguage || 'uk');
    const changedFields  = [];

    for (const field of TRANSLATABLE) {
      if (req.body[field] === undefined) continue;
      if (isSourceLang) restaurant[field] = req.body[field];
      const translations = restaurant.translations
        ? JSON.parse(JSON.stringify(restaurant.translations)) : {};
      setTranslationEntry(translations, lang, field, req.body[field], true);
      restaurant.translations = translations;
      restaurant.markModified('translations');
      changedFields.push(field);
    }

    if (req.body.slug !== undefined)
      restaurant.slug = req.body.slug.toLowerCase().trim();
    if (req.body.defaultLanguage !== undefined && LANGUAGES.includes(req.body.defaultLanguage))
      restaurant.defaultLanguage = req.body.defaultLanguage;
    if (req.body.enabledLanguages !== undefined && Array.isArray(req.body.enabledLanguages))
      restaurant.enabledLanguages = req.body.enabledLanguages.filter(l => LANGUAGES.includes(l));

    await restaurant.save();

    if (changedFields.length && isSourceLang)
      scheduleAutoTranslate(restaurant, changedFields, lang, restaurant.enabledLanguages);

    emit(`restaurant:${req.restaurantId}`, 'RESTAURANT_UPDATED', {});
    res.json({ data: restaurant, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/logo', ...adminAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return next(badRequest('No file uploaded'));
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype))
      return next(badRequest('Invalid file type. Allowed: JPG, PNG, WEBP'));
    const key = `restaurants/${req.restaurantId}/logo_${Date.now()}`;
    const url = await uploadImage(req.file.buffer, key, req.file.mimetype);
    await Restaurant.findByIdAndUpdate(req.restaurantId, { logoUrl: url });
    emit(`restaurant:${req.restaurantId}`, 'RESTAURANT_UPDATED', { logoUrl: url });
    res.json({ data: { logoUrl: url }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/admin/restaurant/liqpay — check stored key status
router.get('/liqpay', ...adminAuth, async (req, res, next) => {
  try {
    const r = await Restaurant.findById(req.restaurantId)
      .select('liqpayPublicKey liqpayPrivateKeyEnc').lean();
    if (!r) return next(notFound('Restaurant not found'));
    res.json({
      data: {
        publicKey:     r.liqpayPublicKey || null,
        hasPrivateKey: !!r.liqpayPrivateKeyEnc,
      },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// PUT /:restaurantId/admin/restaurant/liqpay — save LiqPay keys
router.put('/liqpay', ...adminAuth, async (req, res, next) => {
  try {
    const { publicKey, privateKey } = req.body;
    if (!publicKey || !privateKey) return next(badRequest('publicKey and privateKey are required'));

    // Validate credentials with LiqPay before persisting them
    const liqpay     = createLiqpayService(publicKey, privateKey);
    const validation = await liqpay.validateKeys();
    if (!validation.valid && !validation.networkError) {
      return next(badRequest('LIQPAY_INVALID_CREDENTIALS', 'LiqPay credentials are invalid — please check your public and private keys'));
    }

    const { iv, ciphertext, authTag } = encrypt(privateKey);
    await Restaurant.findByIdAndUpdate(req.restaurantId, {
      liqpayPublicKey:     publicKey,
      liqpayPrivateKeyEnc: ciphertext,
      liqpayPrivateKeyIV:  iv,
      liqpayPrivateKeyTag: authTag,
    });

    // Bust the client-side availability cache so the next check re-validates
    try {
      const { cardStatusCache } = require('../payments');
      if (cardStatusCache) cardStatusCache.delete(String(req.restaurantId));
    } catch (_) { /* cache not critical */ }

    emit(`restaurant:${req.restaurantId}`, 'RESTAURANT_UPDATED', { liqpay: true });
    res.json({ data: { saved: true }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
