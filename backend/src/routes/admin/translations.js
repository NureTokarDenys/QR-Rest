/**
 * Admin translation management endpoints.
 *
 * All routes require admin role + same restaurant.
 *
 * Endpoints:
 *   GET    /admin/translations/:entityType/:entityId
 *          → Returns full translations map + list of translatable fields
 *
 *   PATCH  /admin/translations
 *          → Set manual override for one language
 *          Body: { entityType, entityId, language, fields: { name?, description? } }
 *
 *   DELETE /admin/translations/manual-override
 *          → Remove manual flag from fields (they'll be auto-translated on next trigger)
 *          Body: { entityType, entityId, language, fields: ['name'] }
 *
 *   POST   /admin/translations/auto-translate
 *          → Synchronously re-translate all non-manual fields for all enabled languages
 *          Body: { entityType, entityId }
 */

const router = require('express').Router({ mergeParams: true });
const { requireAuth }           = require('../../middleware/auth');
const { requireRole }           = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { badRequest, notFound }  = require('../../middleware/validate');
const requirePlan               = require('../../middleware/requirePlan');
const { autoTranslateEntity }   = require('../../services/translationService');
const { setTranslationEntry }   = require('../../utils/translatedField');
const { LANGUAGES }             = require('../../config/i18n');

const MenuItem        = require('../../models/MenuItem');
const Category        = require('../../models/Category');
const AddOn           = require('../../models/AddOn');
const Ingredient      = require('../../models/Ingredient');
const ComponentGroup  = require('../../models/ComponentGroup');
const ComponentOption = require('../../models/ComponentOption');
const Restaurant      = require('../../models/Restaurant');

const adminAuth = [requireAuth, requireRole('admin'), requireSameRestaurant];

// ── Entity registry ──────────────────────────────────────────────────────────
// Each entry describes which fields are translatable for that entity type.
const ENTITY_CONFIG = {
  MenuItem:        { Model: MenuItem,        fields: ['name', 'description'] },
  Category:        { Model: Category,        fields: ['name'] },
  AddOn:           { Model: AddOn,           fields: ['name'] },
  Ingredient:      { Model: Ingredient,      fields: ['name'] },
  ComponentGroup:  { Model: ComponentGroup,  fields: ['name'] },
  ComponentOption: { Model: ComponentOption, fields: ['name'] },
};

const ENTITY_TYPES = Object.keys(ENTITY_CONFIG).join(', ');

function cfg(entityType) {
  return ENTITY_CONFIG[entityType] ?? null;
}


// ── GET /admin/translations/:entityType/:entityId ────────────────────────────
router.get('/:entityType/:entityId', ...adminAuth, async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const config = cfg(entityType);
    if (!config) return next(notFound(`Unknown entityType. Allowed: ${ENTITY_TYPES}`));

    const entity = await config.Model.findById(entityId).lean();
    if (!entity) return next(notFound(`${entityType} not found`));

    res.json({
      data: {
        translations:       entity.translations || {},
        translatableFields: config.fields,
        supportedLanguages: LANGUAGES,
      },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// ── PATCH /admin/translations — set manual override ──────────────────────────
router.patch('/', ...adminAuth, async (req, res, next) => {
  try {
    const { entityType, entityId, language, fields } = req.body;

    if (!entityType || !entityId || !language || !fields)
      return next(badRequest('entityType, entityId, language and fields are required'));

    if (!LANGUAGES.includes(language))
      return next(badRequest(`Unsupported language "${language}". Allowed: ${LANGUAGES.join(', ')}`));

    const config = cfg(entityType);
    if (!config) return next(badRequest(`Unknown entityType. Allowed: ${ENTITY_TYPES}`));

    const validFields = Object.keys(fields).filter(f => config.fields.includes(f));
    if (!validFields.length)
      return next(badRequest(`No valid fields provided. Translatable fields for ${entityType}: ${config.fields.join(', ')}`));

    const entity = await config.Model.findById(entityId);
    if (!entity) return next(notFound(`${entityType} not found`));

    const translations = entity.translations
      ? JSON.parse(JSON.stringify(entity.translations))
      : {};

    for (const field of validFields) {
      setTranslationEntry(translations, language, field, fields[field], true);
    }

    entity.translations = translations;
    entity.markModified('translations');
    await entity.save();

    res.json({ data: entity, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ── DELETE /admin/translations/manual-override — unpin manual flag ───────────
// After this the field will be overwritten by the next auto-translate call.
router.delete('/manual-override', ...adminAuth, async (req, res, next) => {
  try {
    const { entityType, entityId, language, fields } = req.body;

    if (!entityType || !entityId || !language || !Array.isArray(fields) || !fields.length)
      return next(badRequest('entityType, entityId, language and fields[] are required'));

    if (!LANGUAGES.includes(language))
      return next(badRequest(`Unsupported language "${language}". Allowed: ${LANGUAGES.join(', ')}`));

    const config = cfg(entityType);
    if (!config) return next(badRequest(`Unknown entityType. Allowed: ${ENTITY_TYPES}`));

    const entity = await config.Model.findById(entityId);
    if (!entity) return next(notFound(`${entityType} not found`));

    const translations = entity.translations
      ? JSON.parse(JSON.stringify(entity.translations))
      : {};

    for (const field of fields) {
      if (translations[language]?.[field]) {
        translations[language][field].isManual = false;
      }
    }

    entity.translations = translations;
    entity.markModified('translations');
    await entity.save();

    res.json({ data: entity, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ── POST /admin/translations/auto-translate — trigger Google Translate ────────
// Translates all non-manual fields to the other language synchronously.
// Body: { entityType, entityId, writtenLang }
//   writtenLang — the language the admin wrote in ('uk' | 'en').
//                 Defaults to restaurant.defaultLanguage or 'uk'.
router.post('/auto-translate', ...adminAuth, requirePlan('premium'), async (req, res, next) => {
  try {
    const { entityType, entityId, writtenLang } = req.body;
    if (!entityType || !entityId)
      return next(badRequest('entityType and entityId are required'));

    const config = cfg(entityType);
    if (!config) return next(badRequest(`Unknown entityType. Allowed: ${ENTITY_TYPES}`));

    const entity = await config.Model.findById(entityId);
    if (!entity) return next(notFound(`${entityType} not found`));

    const restaurant = await Restaurant.findById(req.restaurantId).lean();
    const sourceLang = (writtenLang && LANGUAGES.includes(writtenLang))
      ? writtenLang
      : (restaurant?.defaultLanguage ?? 'uk');

    await autoTranslateEntity(entity, config.fields, sourceLang);

    res.json({ data: entity, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
