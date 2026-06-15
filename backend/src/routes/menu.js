const router = require('express').Router({ mergeParams: true });
const MenuItem   = require('../models/MenuItem');
const Category   = require('../models/Category');
const DishReview = require('../models/DishReview');
const { notFound } = require('../middleware/validate');
const { applyTranslations } = require('../utils/translatedField');
const { isSupported } = require('../config/i18n');

/**
 * Resolve the language to serve for this request.
 *
 * Priority:
 *   1. ?lang= query param (if it's a supported language code)
 *   2. First code from Accept-Language header (if supported)
 *   3. restaurant.defaultLanguage
 *   4. 'uk'
 */
function getLang(req) {
  const defaultLang = req.restaurant?.defaultLanguage || 'uk';

  const fromQuery = req.query.lang;
  if (fromQuery && isSupported(fromQuery)) return fromQuery;

  const acceptHeader = req.headers['accept-language'];
  if (acceptHeader) {
    const fromHeader = acceptHeader.split(',')[0].split(/[-;]/)[0].trim().toLowerCase();
    if (isSupported(fromHeader)) return fromHeader;
  }

  return defaultLang;
}

/** Return the restaurant's default language, used as the fallback tier in resolveField. */
function getDefaultLang(req) {
  return req.restaurant?.defaultLanguage || 'uk';
}

/** Build a { itemId -> { rating, reviewCount } } map for a list of item _ids */
async function buildRatingMap(itemIds) {
  if (!itemIds.length) return {};
  const rows = await DishReview.aggregate([
    { $match: { menuItemId: { $in: itemIds } } },
    { $group: { _id: '$menuItemId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const map = {};
  rows.forEach(r => {
    map[r._id.toString()] = {
      rating:      parseFloat(r.avg.toFixed(1)),
      reviewCount: r.count,
    };
  });
  return map;
}

// restaurantId is already resolved to a MongoDB ObjectId by restaurantParam middleware.
// All routes here simply use req.restaurantId.

function paginate(query) {
  const page  = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// GET /:restaurantId/menu?lang=en — full menu grouped by category
router.get('/', async (req, res, next) => {
  try {
    const { restaurantId } = req;
    const lang        = getLang(req);
    const defaultLang = getDefaultLang(req);

    const categories = await Category.find({ restaurantId, isDeleted: false }).sort({ sortOrder: 1 }).lean();
    const items      = await MenuItem.find({ restaurantId, isAvailable: true, isDeleted: false }).sort({ sortOrder: 1 }).lean();

    const ratingMap = await buildRatingMap(items.map(i => i._id));

    const catMap = {};
    categories.forEach((c) => {
      catMap[c._id] = { ...applyTranslations(c, ['name'], lang, defaultLang), items: [] };
    });
    items.forEach((item) => {
      if (catMap[item.categoryId]) {
        const r = ratingMap[item._id.toString()];
        catMap[item.categoryId].items.push({
          ...applyTranslations(item, ['name', 'description'], lang, defaultLang),
          rating:      r ? r.rating      : null,
          reviewCount: r ? r.reviewCount : 0,
        });
      }
    });

    res.json({ data: Object.values(catMap), meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/menu/categories?lang=en
router.get('/categories', async (req, res, next) => {
  try {
    const lang        = getLang(req);
    const defaultLang = getDefaultLang(req);
    const cats = await Category.find({ restaurantId: req.restaurantId, isDeleted: false }).sort({ sortOrder: 1 }).lean();
    const translated = cats.map(c => applyTranslations(c, ['name'], lang, defaultLang));
    res.json({ data: translated, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/menu/categories/:categoryId/items?lang=en
router.get('/categories/:categoryId/items', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const lang        = getLang(req);
    const defaultLang = getDefaultLang(req);

    const category = await Category.findOne({ _id: req.params.categoryId, restaurantId: req.restaurantId }).lean();
    if (!category || category.isDeleted) return next(notFound('Category not found'));

    const [items, total] = await Promise.all([
      MenuItem.find({ categoryId: category._id, isAvailable: true, isDeleted: false }).sort({ sortOrder: 1 }).skip(skip).limit(limit).lean(),
      MenuItem.countDocuments({ categoryId: category._id, isAvailable: true, isDeleted: false }),
    ]);

    const translated = items.map(item => applyTranslations(item, ['name', 'description'], lang, defaultLang));
    res.json({ data: translated, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// GET /:restaurantId/menu/items/:itemId?lang=en — dish detail with embedded ingredients, addons, component groups
router.get('/items/:itemId', async (req, res, next) => {
  try {
    const lang        = getLang(req);
    const defaultLang = getDefaultLang(req);
    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId, isDeleted: false }).lean();
    if (!item) return next(notFound('Menu item not found'));

    // Resolve name from embedded flat field: name (ua source) or name_en (English)
    function resolveName(obj) {
      if (lang === 'en' && obj.name_en) return obj.name_en;
      return obj.name;
    }

    const ingredients = (item.ingredients || []).map(i => ({ ...i, name: resolveName(i) }));
    const addons      = (item.addons      || []).filter(a => a.isAvailable !== false)
                                                 .map(a => ({ ...a, name: resolveName(a) }));
    const componentGroups = (item.componentGroups || [])
      .filter(g => g.isAvailable !== false)
      .map(g => ({
        ...g,
        name: resolveName(g),
        options: (g.options || []).map(o => ({ ...o, name: resolveName(o) })),
      }));

    const ratingMap = await buildRatingMap([item._id]);
    const r = ratingMap[item._id.toString()];
    res.json({
      data: {
        ...applyTranslations(item, ['name', 'description'], lang, defaultLang),
        weight:      item.weight || null,
        ingredients,
        addons,
        componentGroups,
        rating:      r ? r.rating      : null,
        reviewCount: r ? r.reviewCount : 0,
      },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// GET /:restaurantId/menu/search?q=&categoryId=&lang=en
router.get('/search', async (req, res, next) => {
  try {
    const { q, categoryId } = req.query;
    const lang        = getLang(req);
    const defaultLang = getDefaultLang(req);
    const filter = { restaurantId: req.restaurantId, isAvailable: true, isDeleted: false };
    if (q) filter.name = { $regex: q, $options: 'i' };
    if (categoryId) filter.categoryId = categoryId;

    const items = await MenuItem.find(filter).sort({ sortOrder: 1 }).limit(50).lean();
    const ratingMap = await buildRatingMap(items.map(i => i._id));
    const enriched = items.map(item => {
      const r = ratingMap[item._id.toString()];
      return { ...applyTranslations(item, ['name', 'description'], lang, defaultLang), rating: r ? r.rating : null, reviewCount: r ? r.reviewCount : 0 };
    });
    res.json({ data: enriched, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

module.exports = router;
