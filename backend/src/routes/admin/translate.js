/**
 * POST /:restaurantId/admin/translate
 * Body: { texts: string[], targetLang: string, sourceLang?: string }
 * Returns: { data: { translations: string[] } }
 *
 * Simple Google Translate proxy — translates an ordered array of strings.
 * Empty/whitespace-only strings are passed through as '' without calling the API.
 */

const router = require('express').Router({ mergeParams: true });
const { requireAuth }           = require('../../middleware/auth');
const { requireRole }           = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const requirePlan               = require('../../middleware/requirePlan');
const { translateBatch }        = require('../../services/translationService');

// Allow all staff roles that can edit menu content; premium plan only.
const adminAuth = [
  requireAuth,
  requireRole('admin', 'cook', 'waiter_cook'),
  requireSameRestaurant,
  requirePlan('premium'),
];

router.post('/', ...adminAuth, async (req, res, next) => {
  try {
    const { texts, targetLang, sourceLang = 'uk' } = req.body;

    if (!Array.isArray(texts) || !texts.length || !targetLang) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'texts[] and targetLang are required' },
        meta:  { request_id: req.requestId },
      });
    }

    // Only send non-empty strings to the API; map results back to original indices.
    const indices     = [];
    const toTranslate = [];
    texts.forEach((t, i) => {
      if (t && t.trim()) { indices.push(i); toTranslate.push(t); }
    });

    const translations = new Array(texts.length).fill('');

    if (toTranslate.length > 0) {
      const translated = await translateBatch(toTranslate, targetLang, sourceLang);
      indices.forEach((origIdx, i) => {
        translations[origIdx] = translated[i] ?? '';
      });
    }

    res.json({ data: { translations }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
