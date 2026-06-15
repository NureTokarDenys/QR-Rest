const router = require('express').Router();
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { badRequest } = require('../middleware/validate');
const { nextPublicId } = require('../utils/publicId');
const { applyTranslations } = require('../utils/translatedField');
const { isSupported } = require('../config/i18n');

// Fields fetched from DB — includes translations + language config for resolution,
// but translations is stripped before sending to the client.
const FETCH_FIELDS = '_id name slug address logoUrl cuisine isActive plan defaultLanguage enabledLanguages translations';

// Fields exposed in the public response (translations is internal structure, not exposed).
const PUBLIC_FIELDS = ['_id', 'name', 'slug', 'address', 'logoUrl', 'cuisine', 'isActive', 'plan', 'defaultLanguage', 'enabledLanguages'];

/**
 * Resolve requested language from ?lang= or Accept-Language header.
 * Falls back to null so callers can use each restaurant's own defaultLanguage.
 */
function getLang(req) {
  const fromQuery = req.query.lang;
  if (fromQuery && isSupported(fromQuery)) return fromQuery;

  const acceptHeader = req.headers['accept-language'];
  if (acceptHeader) {
    const fromHeader = acceptHeader.split(',')[0].split(/[-;]/)[0].trim().toLowerCase();
    if (isSupported(fromHeader)) return fromHeader;
  }

  return null;
}

/**
 * Apply translations to a restaurant document and return only public fields.
 * Each restaurant uses its own defaultLanguage as the fallback tier.
 */
function resolveRestaurant(r, requestedLang) {
  const defaultLang  = r.defaultLanguage || 'uk';
  const lang         = requestedLang || defaultLang;
  const translated   = applyTranslations(r, ['name', 'cuisine'], lang, defaultLang);
  return Object.fromEntries(PUBLIC_FIELDS.map(f => [f, translated[f]]));
}

// GET /restaurants?lang=en — public listing with optional search
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = { isActive: { $ne: false } };

    if (req.query.q && req.query.q.trim()) {
      const q = req.query.q.trim();
      filter.$or = [
        { name:    { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
        { slug:    { $regex: q, $options: 'i' } },
        { cuisine: { $regex: q, $options: 'i' } },
      ];
    }

    const lang = getLang(req);

    const [restaurants, total] = await Promise.all([
      Restaurant.find(filter).select(FETCH_FIELDS).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Restaurant.countDocuments(filter),
    ]);

    res.json({
      data: restaurants.map(r => resolveRestaurant(r, lang)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// POST /restaurants/register — onboard new restaurant + first admin
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, restaurantName, restaurantAddress } = req.body;
    if (!email || !password || !name || !restaurantName) {
      return next(badRequest('email, password, name, restaurantName are required'));
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'Email already registered' },
        meta: { request_id: req.requestId },
      });
    }

    const id   = await nextPublicId(Restaurant);
    const slug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    const restaurant = await Restaurant.create({
      _id: id,
      name: restaurantName,
      slug,
      address: restaurantAddress,
    });

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role: 'root_admin', restaurantId: restaurant._id });

    const { signAccess, signRefresh } = require('../config/jwt');
    const payload = { sub: user._id, role: user.role, restaurantId: user.restaurantId };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);

    res.status(201).json({
      data: {
        restaurant,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        accessToken,
        refreshToken,
      },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

module.exports = router;
