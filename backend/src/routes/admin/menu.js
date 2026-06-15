const router = require('express').Router({ mergeParams: true });
const multer = require('multer');
const Category       = require('../../models/Category');
const MenuItem       = require('../../models/MenuItem');
const Ingredient     = require('../../models/Ingredient');
const AddOn          = require('../../models/AddOn');
const ComponentGroup  = require('../../models/ComponentGroup');
const ComponentOption = require('../../models/ComponentOption');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const { requireSameRestaurant } = require('../../middleware/restaurantParam');
const { notFound, badRequest } = require('../../middleware/validate');
const { uploadImage, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } = require('../../config/aws');
const { emit } = require('../../services/wsService');
const { scheduleAutoTranslate }               = require('../../services/translationService');
const { LANGUAGES }                            = require('../../config/i18n');
const { markAsManual, setTranslationEntry }    = require('../../utils/translatedField');
const { flattenTranslations, flattenTranslationsAll } = require('../../services/i18nFlatten');
const Restaurant                               = require('../../models/Restaurant');

/** Return the language the admin is writing in for this request. */
async function inputLang(req) {
  if (req.body.lang && LANGUAGES.includes(req.body.lang)) return req.body.lang;
  const r = await Restaurant.findById(req.restaurantId).lean();
  return (r?.defaultLanguage && LANGUAGES.includes(r.defaultLanguage))
    ? r.defaultLanguage
    : 'uk';
}

const requirePlan = require('../../middleware/requirePlan');

const adminAuth = [requireAuth, requireRole('admin', 'cook', 'waiter_cook'), requireSameRestaurant];
const upload    = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

const FREE_CATEGORY_LIMIT = 5;
const FREE_ITEM_LIMIT     = 50;
const FREE_IMAGE_LIMIT    = 3;

function paginate(q) {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(9999, Math.max(1, parseInt(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function getUsageFromItems(items, type, sourceId) {
  const sid = String(sourceId);
  const list = [];
  for (const it of items) {
    if (type === 'ingredients') {
      if ((it.ingredients || []).some(x => String(x.sourceId) === sid)) {
        list.push({ _id: it._id, name: it.name, translations: it.translations });
      }
    } else if (type === 'addons') {
      if ((it.addons || []).some(x => String(x.sourceId) === sid)) {
        list.push({ _id: it._id, name: it.name, translations: it.translations });
      }
    } else if (type === 'componentGroups') {
      if ((it.componentGroups || []).some(x => String(x.sourceId) === sid)) {
        list.push({ _id: it._id, name: it.name, translations: it.translations });
      }
    }
  }
  return list;
}

// ── Categories ───────────────────────────────────────────────────────────

router.get('/categories', ...adminAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const [cats, total] = await Promise.all([
      Category.find({ restaurantId: req.restaurantId, isDeleted: false }).sort({ sortOrder: 1 }).skip(skip).limit(limit).lean(),
      Category.countDocuments({ restaurantId: req.restaurantId, isDeleted: false }),
    ]);
    // Inject flat `name_en` from translations so the frontend's useLocalField
    // can resolve the active language at render time (matches /staff/map pattern).
    const data = flattenTranslationsAll(cats, ['name']);
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/categories', ...adminAuth, async (req, res, next) => {
  try {
    const { name, sortOrder, color } = req.body;
    if (!name) return next(badRequest('name is required'));
    if ((req.restaurant?.plan || 'free') === 'free') {
      const count = await Category.countDocuments({ restaurantId: req.restaurantId, isDeleted: false });
      if (count >= FREE_CATEGORY_LIMIT) {
        return res.status(403).json({
          error: { code: 'PLAN_LIMIT_REACHED', message: `Free plan allows up to ${FREE_CATEGORY_LIMIT} categories`, requiredPlan: 'premium', limitType: 'categories', limit: FREE_CATEGORY_LIMIT },
          meta: {},
        });
      }
    }
    const lang = await inputLang(req);
    const translations = {};
    setTranslationEntry(translations, lang, 'name', name, true);
    const cat = await Category.create({ name, sortOrder: sortOrder || 0, color: color || null, restaurantId: req.restaurantId, translations });
    scheduleAutoTranslate(cat, ['name'], lang, req.restaurant?.enabledLanguages);
    emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'CATEGORY_CREATED', categoryId: cat._id });
    res.status(201).json({ data: cat, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/categories/:categoryId', ...adminAuth, async (req, res, next) => {
  try {
    const cat = await Category.findOne({ _id: req.params.categoryId, restaurantId: req.restaurantId, isDeleted: false });
    if (!cat) return next(notFound('Category not found'));
    const lang = req.body.name !== undefined ? await inputLang(req) : null;
    const isSourceLang = lang === 'uk';
    if (req.body.name !== undefined) {
      if (isSourceLang) cat.name = req.body.name;
      const translations = cat.translations ? JSON.parse(JSON.stringify(cat.translations)) : {};
      setTranslationEntry(translations, lang, 'name', req.body.name, true);
      cat.translations = translations;
      cat.markModified('translations');
    }
    if (req.body.sortOrder !== undefined) cat.sortOrder = req.body.sortOrder;
    if (req.body.color     !== undefined) cat.color     = req.body.color || null;
    await cat.save();
    if (lang && isSourceLang) scheduleAutoTranslate(cat, ['name'], lang, req.restaurant?.enabledLanguages);
    emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'CATEGORY_UPDATED', categoryId: cat._id });
    res.json({ data: cat, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.delete('/categories/:categoryId', ...adminAuth, async (req, res, next) => {
  try {
    const cat = await Category.findOne({ _id: req.params.categoryId, restaurantId: req.restaurantId });
    if (!cat) return next(notFound('Category not found'));
    cat.isDeleted = true;
    await cat.save();
    emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'CATEGORY_DELETED', categoryId: cat._id });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/categories/:categoryId/image', ...adminAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return next(badRequest('image is required'));
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) return next(badRequest('Invalid image type. Allowed: jpeg, png, webp'));
    const cat = await Category.findOne({ _id: req.params.categoryId, restaurantId: req.restaurantId, isDeleted: false });
    if (!cat) return next(notFound('Category not found'));
    const key = `restaurants/${req.restaurantId}/categories/${cat._id}-${Date.now()}`;
    const url = await uploadImage(req.file.buffer, req.file.mimetype, key);
    if (!cat.images) cat.images = [];
    cat.images.push(url);
    cat.imageUrl = cat.images[cat.selectedImageIdx ?? 0] || url;
    await cat.save();
    res.json({ data: { imageUrl: url, images: cat.images, selectedImageIdx: cat.selectedImageIdx ?? 0 }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/categories/:categoryId/images', ...adminAuth, async (req, res, next) => {
  try {
    const { images, selectedImageIdx } = req.body;
    if (!Array.isArray(images)) return next(badRequest('images must be an array'));
    const cat = await Category.findOne({ _id: req.params.categoryId, restaurantId: req.restaurantId, isDeleted: false });
    if (!cat) return next(notFound('Category not found'));
    cat.images = images;
    cat.selectedImageIdx = Math.min(Math.max(0, selectedImageIdx ?? 0), Math.max(0, images.length - 1));
    cat.imageUrl = images[cat.selectedImageIdx] || cat.imageUrl || '';
    await cat.save();
    res.json({ data: { images: cat.images, selectedImageIdx: cat.selectedImageIdx }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ── Global extras summary (for ExtrasManagement page) ────────────────────

router.get('/extras', ...adminAuth, async (req, res, next) => {
  try {
    const [ingredients, addons, componentGroups, menuItems] = await Promise.all([
      Ingredient.find({ restaurantId: req.restaurantId }).lean(),
      AddOn.find({ restaurantId: req.restaurantId }).lean(),
      ComponentGroup.find({ restaurantId: req.restaurantId }).sort({ sortOrder: 1 }).lean(),
      MenuItem.find({ restaurantId: req.restaurantId, isDeleted: false })
        .select('name translations ingredients addons componentGroups')
        .lean(),
    ]);

    const groupIds = componentGroups.map(g => g._id);
    const options  = groupIds.length
      ? await ComponentOption.find({ componentGroupId: { $in: groupIds } }).lean()
      : [];

    // Flatten translations.en.name → name_en on every doc so the frontend
    // useLocalField hook can resolve the active language at render time.
    res.json({
      data: {
        ingredients: ingredients.map(i => flattenTranslations({
          ...i,
          usedInDishes: flattenTranslationsAll(getUsageFromItems(menuItems, 'ingredients', i._id), ['name']),
        }, ['name'])),
        addons: addons.map(a => flattenTranslations({
          ...a,
          usedInDishes: flattenTranslationsAll(getUsageFromItems(menuItems, 'addons', a._id), ['name']),
        }, ['name'])),
        componentGroups: componentGroups.map(g => flattenTranslations({
          ...g,
          options: flattenTranslationsAll(options.filter(o => o.componentGroupId.toString() === g._id.toString()), ['name']),
          usedInDishes: flattenTranslationsAll(getUsageFromItems(menuItems, 'componentGroups', g._id), ['name']),
        }, ['name'])),
      },
      meta: { request_id: req.requestId },
    });
  } catch (err) { next(err); }
});

// ── Global Ingredients ───────────────────────────────────────────────────

router.get('/ingredients', ...adminAuth, async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    const filter = { restaurantId: req.restaurantId };
    if (q) filter.name = { $regex: q, $options: 'i' };
    const items = await Ingredient.find(filter).sort({ name: 1 }).limit(200).lean();
    res.json({ data: items, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/ingredients', ...adminAuth, async (req, res, next) => {
  try {
    const { name, isRemovable } = req.body;
    if (!name) return next(badRequest('name is required'));
    const lang = await inputLang(req);
    const translations = {};
    setTranslationEntry(translations, lang, 'name', name, true);
    const item = await Ingredient.create({ name, isRemovable: isRemovable !== false, restaurantId: req.restaurantId, translations });
    scheduleAutoTranslate(item, ['name'], lang, req.restaurant?.enabledLanguages);
    emit(`restaurant:${req.restaurantId}`, 'EXTRAS_UPDATED', { type: 'INGREDIENT_CREATED', id: item._id });
    res.status(201).json({ data: item, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/ingredients/:id', ...adminAuth, async (req, res, next) => {
  try {
    const item = await Ingredient.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!item) return next(notFound('Ingredient not found'));
    const nameChanged = req.body.name !== undefined && req.body.name !== item.name;
    if (req.body.name        !== undefined) item.name        = req.body.name;
    if (req.body.isRemovable !== undefined) item.isRemovable = req.body.isRemovable;
    if (nameChanged) {
      const lang = await inputLang(req);
      const translations = item.translations ? JSON.parse(JSON.stringify(item.translations)) : {};
      setTranslationEntry(translations, lang, 'name', item.name, true);
      item.translations = translations;
      item.markModified('translations');
      await item.save();
      scheduleAutoTranslate(item, ['name'], lang, req.restaurant?.enabledLanguages);
    } else {
      await item.save();
    }
    emit(`restaurant:${req.restaurantId}`, 'EXTRAS_UPDATED', { type: 'INGREDIENT_UPDATED', id: item._id });
    res.json({ data: item, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.delete('/ingredients/:id', ...adminAuth, async (req, res, next) => {
  try {
    const item = await Ingredient.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!item) return next(notFound('Ingredient not found'));
    const force = req.query.force === 'true';
    const usedInDishes = await MenuItem.find({
      restaurantId: req.restaurantId,
      isDeleted: false,
      'ingredients.sourceId': item._id,
    }).select('name').lean();
    if (usedInDishes.length && !force) {
      return res.status(409).json({
        error: {
          code: 'EXTRA_IN_USE',
          message: 'Ingredient is used in dishes',
          data: {
            usedInCount: usedInDishes.length,
            usedInDishes: usedInDishes.map(d => ({ _id: d._id, name: d.name })),
          },
        },
        meta: { request_id: req.requestId },
      });
    }
    if (force) {
      await MenuItem.updateMany(
        { restaurantId: req.restaurantId, isDeleted: false },
        { $pull: { ingredients: { sourceId: item._id } } }
      );
    }
    await item.deleteOne();
    emit(`restaurant:${req.restaurantId}`, 'EXTRAS_UPDATED', { type: 'INGREDIENT_DELETED', id: item._id });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.patch('/ingredients/:id/availability', ...adminAuth, async (req, res, next) => {
  try {
    const item = await Ingredient.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!item) return next(notFound('Ingredient not found'));
    item.isAvailable = req.body.isAvailable !== false;
    await item.save();
    emit(`restaurant:${req.restaurantId}`, 'EXTRAS_UPDATED', { type: 'INGREDIENT_AVAILABILITY', id: item._id, isAvailable: item.isAvailable });
    res.json({ data: item, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ── Global AddOns ────────────────────────────────────────────────────────

router.get('/addons', ...adminAuth, async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    const filter = { restaurantId: req.restaurantId };
    if (q) filter.name = { $regex: q, $options: 'i' };
    const items = await AddOn.find(filter).sort({ name: 1 }).limit(200).lean();
    res.json({ data: items, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/addons', ...adminAuth, async (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined) return next(badRequest('name and price are required'));
    const lang = await inputLang(req);
    const translations = {};
    setTranslationEntry(translations, lang, 'name', name, true);
    const addon = await AddOn.create({ name, price, restaurantId: req.restaurantId, translations });
    scheduleAutoTranslate(addon, ['name'], lang, req.restaurant?.enabledLanguages);
    res.status(201).json({ data: addon, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/addons/:id', ...adminAuth, async (req, res, next) => {
  try {
    const addon = await AddOn.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!addon) return next(notFound('AddOn not found'));
    const nameChanged = req.body.name !== undefined && req.body.name !== addon.name;
    if (req.body.name  !== undefined) addon.name  = req.body.name;
    if (req.body.price !== undefined) addon.price = req.body.price;
    if (nameChanged) {
      const lang = await inputLang(req);
      const translations = addon.translations ? JSON.parse(JSON.stringify(addon.translations)) : {};
      setTranslationEntry(translations, lang, 'name', addon.name, true);
      addon.translations = translations;
      addon.markModified('translations');
      await addon.save();
      scheduleAutoTranslate(addon, ['name'], lang, req.restaurant?.enabledLanguages);
    } else {
      await addon.save();
    }
    res.json({ data: addon, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.delete('/addons/:id', ...adminAuth, async (req, res, next) => {
  try {
    const addon = await AddOn.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!addon) return next(notFound('AddOn not found'));
    const force = req.query.force === 'true';
    const usedInDishes = await MenuItem.find({
      restaurantId: req.restaurantId,
      isDeleted: false,
      'addons.sourceId': addon._id,
    }).select('name').lean();
    if (usedInDishes.length && !force) {
      return res.status(409).json({
        error: {
          code: 'EXTRA_IN_USE',
          message: 'AddOn is used in dishes',
          data: {
            usedInCount: usedInDishes.length,
            usedInDishes: usedInDishes.map(d => ({ _id: d._id, name: d.name })),
          },
        },
        meta: { request_id: req.requestId },
      });
    }
    if (force) {
      await MenuItem.updateMany(
        { restaurantId: req.restaurantId, isDeleted: false },
        { $pull: { addons: { sourceId: addon._id } } }
      );
    }
    await addon.deleteOne();
    res.status(204).send();
  } catch (err) { next(err); }
});

router.patch('/addons/:id/availability', ...adminAuth, async (req, res, next) => {
  try {
    const addon = await AddOn.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!addon) return next(notFound('AddOn not found'));
    addon.isAvailable = req.body.isAvailable !== false;
    await addon.save();
    res.json({ data: addon, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ── Global ComponentGroups ───────────────────────────────────────────────

router.get('/componentgroups', ...adminAuth, async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    const filter = { restaurantId: req.restaurantId };
    if (q) filter.name = { $regex: q, $options: 'i' };
    const groups  = await ComponentGroup.find(filter).sort({ name: 1 }).limit(200).lean();
    const ids     = groups.map(g => g._id);
    const options = ids.length ? await ComponentOption.find({ componentGroupId: { $in: ids } }).lean() : [];
    const result  = groups.map(g => ({
      ...g,
      options: options.filter(o => o.componentGroupId.toString() === g._id.toString()),
    }));
    res.json({ data: result, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/componentgroups', ...adminAuth, async (req, res, next) => {
  try {
    const { name, isRequired, options } = req.body;
    if (!name) return next(badRequest('name is required'));
    const lang = await inputLang(req);
    const groupTranslations = {};
    setTranslationEntry(groupTranslations, lang, 'name', name, true);
    const group = await ComponentGroup.create({ name, isRequired: isRequired || false, restaurantId: req.restaurantId, translations: groupTranslations });
    scheduleAutoTranslate(group, ['name'], lang, req.restaurant?.enabledLanguages);

    const createdOptions = [];
    if (options?.length) {
      for (const opt of options) {
        const optTranslations = {};
        setTranslationEntry(optTranslations, lang, 'name', opt.name, true);
        const o = await ComponentOption.create({ componentGroupId: group._id, name: opt.name, priceModifier: opt.priceModifier || 0, isDefault: opt.isDefault || false, translations: optTranslations });
        scheduleAutoTranslate(o, ['name'], lang, req.restaurant?.enabledLanguages);
        createdOptions.push(o);
      }
    }
    res.status(201).json({ data: { ...group.toObject(), options: createdOptions }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/componentgroups/:id', ...adminAuth, async (req, res, next) => {
  try {
    const group = await ComponentGroup.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!group) return next(notFound('ComponentGroup not found'));
    const nameChanged = req.body.name !== undefined && req.body.name !== group.name;
    if (req.body.name       !== undefined) group.name       = req.body.name;
    if (req.body.isRequired !== undefined) group.isRequired = req.body.isRequired;
    if (nameChanged) {
      const lang = await inputLang(req);
      const translations = group.translations ? JSON.parse(JSON.stringify(group.translations)) : {};
      setTranslationEntry(translations, lang, 'name', group.name, true);
      group.translations = translations;
      group.markModified('translations');
      await group.save();
      scheduleAutoTranslate(group, ['name'], lang, req.restaurant?.enabledLanguages);
    } else {
      await group.save();
    }

    // Update options if provided
    if (req.body.options) {
      await ComponentOption.deleteMany({ componentGroupId: group._id });
      const lang = await inputLang(req);
      for (const opt of req.body.options) {
        const optTranslations = {};
        setTranslationEntry(optTranslations, lang, 'name', opt.name, true);
        await ComponentOption.create({ componentGroupId: group._id, name: opt.name, priceModifier: opt.priceModifier || 0, isDefault: opt.isDefault || false, translations: optTranslations });
      }
    }

    const options = await ComponentOption.find({ componentGroupId: group._id }).lean();
    res.json({ data: { ...group.toObject(), options }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.delete('/componentgroups/:id', ...adminAuth, async (req, res, next) => {
  try {
    const group = await ComponentGroup.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!group) return next(notFound('ComponentGroup not found'));
    const force = req.query.force === 'true';
    const usedInDishes = await MenuItem.find({
      restaurantId: req.restaurantId,
      isDeleted: false,
      'componentGroups.sourceId': group._id,
    }).select('name').lean();
    if (usedInDishes.length && !force) {
      return res.status(409).json({
        error: {
          code: 'EXTRA_IN_USE',
          message: 'ComponentGroup is used in dishes',
          data: {
            usedInCount: usedInDishes.length,
            usedInDishes: usedInDishes.map(d => ({ _id: d._id, name: d.name })),
          },
        },
        meta: { request_id: req.requestId },
      });
    }
    if (force) {
      await MenuItem.updateMany(
        { restaurantId: req.restaurantId, isDeleted: false },
        { $pull: { componentGroups: { sourceId: group._id } } }
      );
    }
    await group.deleteOne();
    await ComponentOption.deleteMany({ componentGroupId: group._id });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.delete('/extras/:type/:id/dishes/:itemId', ...adminAuth, async (req, res, next) => {
  try {
    const { type, id, itemId } = req.params;
    const sourceId = id;
    const menuItem = await MenuItem.findOne({ _id: itemId, restaurantId: req.restaurantId, isDeleted: false });
    if (!menuItem) return next(notFound('Menu item not found'));
    if (type === 'ingredients') {
      menuItem.ingredients = (menuItem.ingredients || []).filter(x => String(x.sourceId) !== String(sourceId));
      menuItem.markModified('ingredients');
    } else if (type === 'addons') {
      menuItem.addons = (menuItem.addons || []).filter(x => String(x.sourceId) !== String(sourceId));
      menuItem.markModified('addons');
    } else if (type === 'componentGroups') {
      menuItem.componentGroups = (menuItem.componentGroups || []).filter(x => String(x.sourceId) !== String(sourceId));
      menuItem.markModified('componentGroups');
    } else {
      return next(badRequest('type must be ingredients, addons, or componentGroups'));
    }
    await menuItem.save();
    res.status(204).send();
  } catch (err) { next(err); }
});

router.patch('/componentgroups/:id/availability', ...adminAuth, async (req, res, next) => {
  try {
    const group = await ComponentGroup.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!group) return next(notFound('ComponentGroup not found'));
    group.isAvailable = req.body.isAvailable !== false;
    await group.save();
    res.json({ data: group, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ── Menu Items ───────────────────────────────────────────────────────────

router.get('/items', ...adminAuth, async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { restaurantId: req.restaurantId, isDeleted: false };
    if (req.query.categoryId)   filter.categoryId  = req.query.categoryId;
    if (req.query.isAvailable !== undefined) filter.isAvailable = req.query.isAvailable === 'true';

    const [items, total] = await Promise.all([
      MenuItem.find(filter).sort({ sortOrder: 1 }).skip(skip).limit(limit).lean(),
      MenuItem.countDocuments(filter),
    ]);
    const data = flattenTranslationsAll(items, ['name', 'description', 'weight']);
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.get('/items/:itemId', ...adminAuth, async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId, isDeleted: false }).lean();
    if (!item) return next(notFound('Menu item not found'));
    const data = flattenTranslations(item, ['name', 'description', 'weight']);
    res.json({ data, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.post('/items', ...adminAuth, async (req, res, next) => {
  try {
    const { name, description, name_en, description_en, price, categoryId, isAvailable, sortOrder, weight, ingredients, addons, componentGroups } = req.body;
    if (!name || !price || !categoryId) return next(badRequest('name, price and categoryId are required'));
    if ((req.restaurant?.plan || 'free') === 'free') {
      const count = await MenuItem.countDocuments({ restaurantId: req.restaurantId, isDeleted: false });
      if (count >= FREE_ITEM_LIMIT) {
        return res.status(403).json({
          error: { code: 'PLAN_LIMIT_REACHED', message: `Free plan allows up to ${FREE_ITEM_LIMIT} menu items`, requiredPlan: 'premium', limitType: 'items', limit: FREE_ITEM_LIMIT },
          meta: {},
        });
      }
    }
    const lang = await inputLang(req);
    const translations = {};
    setTranslationEntry(translations, lang, 'name', name, true);
    if (description) setTranslationEntry(translations, lang, 'description', description, true);
    if (name_en)        setTranslationEntry(translations, 'en', 'name',        name_en,        true);
    if (description_en) setTranslationEntry(translations, 'en', 'description', description_en, true);
    const { weight_en } = req.body;
    if (weight_en)      setTranslationEntry(translations, 'en', 'weight',      weight_en,      true);
    const item = await MenuItem.create({
      name, description, basePrice: price, categoryId, restaurantId: req.restaurantId,
      isAvailable: isAvailable !== false, sortOrder: sortOrder || 0, translations,
      weight: weight || null,
      ingredients:     ingredients     || [],
      addons:          addons          || [],
      componentGroups: componentGroups || [],
    });
    scheduleAutoTranslate(item, ['name', 'description'], lang, req.restaurant?.enabledLanguages);
    emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'ITEM_CREATED', menuItemId: item._id });
    res.status(201).json({ data: item, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/items/:itemId', ...adminAuth, async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId, isDeleted: false });
    if (!item) return next(notFound('Menu item not found'));
    const translatableChanged = ['name', 'description'].filter(f => req.body[f] !== undefined && req.body[f] !== item[f]);
    ['name', 'description', 'sortOrder', 'categoryId'].forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    if (req.body.price             !== undefined) item.basePrice        = req.body.price;
    if (req.body.weight            !== undefined) item.weight           = req.body.weight || null;
    if (req.body.ingredients       !== undefined) { item.ingredients     = req.body.ingredients;     item.markModified('ingredients'); }
    if (req.body.addons            !== undefined) { item.addons          = req.body.addons;           item.markModified('addons'); }
    if (req.body.componentGroups   !== undefined) { item.componentGroups = req.body.componentGroups;  item.markModified('componentGroups'); }
    if (req.body.isAvailable !== undefined) {
      item.isAvailable = req.body.isAvailable;
      emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'ITEM_UPDATED', menuItemId: item._id, isAvailable: item.isAvailable });
    }
    const translations = item.translations ? JSON.parse(JSON.stringify(item.translations)) : {};
    if (translatableChanged.length) {
      const lang = await inputLang(req);
      for (const field of translatableChanged) {
        setTranslationEntry(translations, lang, field, item[field], true);
      }
    }
    if (req.body.name_en        !== undefined) setTranslationEntry(translations, 'en', 'name',        req.body.name_en,        true);
    if (req.body.description_en !== undefined) setTranslationEntry(translations, 'en', 'description', req.body.description_en, true);
    if (req.body.weight_en      !== undefined) setTranslationEntry(translations, 'en', 'weight',      req.body.weight_en,      true);
    if (translatableChanged.length || req.body.name_en !== undefined || req.body.description_en !== undefined || req.body.weight_en !== undefined) {
      item.translations = translations;
      item.markModified('translations');
    }
    await item.save();
    if (translatableChanged.length) scheduleAutoTranslate(item, translatableChanged, await inputLang(req), req.restaurant?.enabledLanguages);
    res.json({ data: item, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.delete('/items/:itemId', ...adminAuth, async (req, res, next) => {
  try {
    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId });
    if (!item) return next(notFound('Menu item not found'));
    item.isDeleted = true;
    await item.save();
    emit(`restaurant:${req.restaurantId}`, 'MENU_UPDATED', { type: 'ITEM_DELETED', menuItemId: item._id });
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/items/:itemId/image', ...adminAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return next(badRequest('image is required'));
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) return next(badRequest('Invalid image type. Allowed: jpeg, png, webp'));

    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId });
    if (!item) return next(notFound('Menu item not found'));

    if ((req.restaurant?.plan || 'free') === 'free') {
      const imgCount = (item.images || []).length;
      if (imgCount >= FREE_IMAGE_LIMIT) {
        return res.status(403).json({
          error: { code: 'PLAN_LIMIT_REACHED', message: `Free plan allows up to ${FREE_IMAGE_LIMIT} images per dish`, requiredPlan: 'premium', limitType: 'images', limit: FREE_IMAGE_LIMIT },
          meta: {},
        });
      }
    }

    const key = `restaurants/${req.restaurantId}/menu/${item._id}-${Date.now()}`;
    const url = await uploadImage(req.file.buffer, req.file.mimetype, key);
    if (!item.images) item.images = [];
    item.images.push(url);
    item.imageUrl = item.images[item.selectedImageIdx ?? 0] || url;
    await item.save();
    res.json({ data: { imageUrl: url, images: item.images, selectedImageIdx: item.selectedImageIdx ?? 0 }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

router.put('/items/:itemId/images', ...adminAuth, async (req, res, next) => {
  try {
    const { images, selectedImageIdx } = req.body;
    if (!Array.isArray(images)) return next(badRequest('images must be an array'));
    const item = await MenuItem.findOne({ _id: req.params.itemId, restaurantId: req.restaurantId, isDeleted: false });
    if (!item) return next(notFound('Menu item not found'));
    item.images = images;
    item.selectedImageIdx = Math.min(Math.max(0, selectedImageIdx ?? 0), Math.max(0, images.length - 1));
    item.imageUrl = images[item.selectedImageIdx] || item.imageUrl || '';
    await item.save();
    res.json({ data: { images: item.images, selectedImageIdx: item.selectedImageIdx }, meta: { request_id: req.requestId } });
  } catch (err) { next(err); }
});

// ── PDF export ───────────────────────────────────────────────────────────

router.get('/pdf', ...adminAuth, async (req, res, next) => {
  try {
    const PDFDocument = require('pdfkit');
    const categories  = await Category.find({ restaurantId: req.restaurantId, isDeleted: false }).sort({ sortOrder: 1 }).lean();
    const items       = await MenuItem.find({ restaurantId: req.restaurantId, isAvailable: true, isDeleted: false }).sort({ sortOrder: 1 }).lean();

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="menu.pdf"');
    doc.pipe(res);

    doc.fontSize(24).text('Menu', { align: 'center' }).moveDown();

    for (const cat of categories) {
      const catItems = items.filter((i) => i.categoryId.toString() === cat._id.toString());
      if (!catItems.length) continue;
      doc.fontSize(16).text(cat.name).moveDown(0.5);
      for (const item of catItems) {
        doc.fontSize(12).text(`${item.name} — ${item.basePrice} UAH`);
        if (item.description) doc.fontSize(10).fillColor('grey').text(item.description).fillColor('black');
        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
