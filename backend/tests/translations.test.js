/**
 * Google Translate integration tests.
 *
 * axios is mocked globally — no real HTTP calls to Google are made.
 *
 * Coverage:
 *   1. translatedField utilities   (pure unit tests)
 *   2. translationService          (unit tests with mocked axios + in-memory DB)
 *   3. Public menu ?lang= routing  (integration)
 *   4. Admin translations CRUD     (integration: GET / PATCH manual / DELETE manual / POST auto-translate)
 *   5. Admin menu create / update triggers auto-translate (integration)
 */

jest.mock('axios');

const request = require('supertest');
const axios   = require('axios');
const app     = require('../src/app');

const { connectTestDB, clearDB, disconnectTestDB } = require('./setup/db');
const { createRestaurant, createStaff, authHeader } = require('./setup/helpers');

const Category        = require('../src/models/Category');
const MenuItem        = require('../src/models/MenuItem');
const Ingredient      = require('../src/models/Ingredient');
const AddOn           = require('../src/models/AddOn');
const ComponentGroup  = require('../src/models/ComponentGroup');
const ComponentOption = require('../src/models/ComponentOption');

const {
  resolveField,
  applyTranslations,
  applyTranslationsMany,
  setTranslationEntry,
  otherLang,
} = require('../src/utils/translatedField');

const { translateBatch, autoTranslateEntity } = require('../src/services/translationService');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a valid Google Translate API response for the given translated strings. */
function mockGoogleResponse(translatedTexts) {
  return {
    data: {
      data: {
        translations: translatedTexts.map(translatedText => ({ translatedText })),
      },
    },
  };
}

/** Set axios.post to return specific translations for the next call. */
function mockTranslate(translatedTexts) {
  axios.post.mockResolvedValueOnce(mockGoogleResponse(translatedTexts));
}

/** Wait for all pending microtasks/promises (lets fire-and-forget settle). */
const flushAsync = () => new Promise(resolve => setImmediate(resolve));

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(() => connectTestDB());
afterEach(async () => {
  await clearDB();
  jest.resetAllMocks();   // clears calls AND drains any queued mockResolvedValueOnce responses
});
afterAll(() => disconnectTestDB());

// ════════════════════════════════════════════════════════════════════════════
// 1. translatedField utilities
// ════════════════════════════════════════════════════════════════════════════

describe('translatedField utilities', () => {
  const entity = {
    name: 'Борщ',
    description: 'Класичний суп',
    translations: {
      en: {
        name:        { value: 'Borscht',       isManual: false },
        description: { value: 'Classic soup',  isManual: true  },
      },
    },
  };

  it('resolveField returns translated value when available', () => {
    expect(resolveField(entity, 'name', 'en')).toBe('Borscht');
  });

  it('resolveField falls back to original field when translation is missing', () => {
    expect(resolveField(entity, 'name', 'de')).toBe('Борщ');
  });

  it('resolveField returns original field for uk (source)', () => {
    expect(resolveField(entity, 'name', 'uk')).toBe('Борщ');
  });

  it('resolveField returns empty string when both are missing', () => {
    expect(resolveField({ translations: {} }, 'name', 'en')).toBe('');
  });

  it('applyTranslations replaces specified fields with translations', () => {
    const result = applyTranslations(entity, ['name', 'description'], 'en');
    expect(result.name).toBe('Borscht');
    expect(result.description).toBe('Classic soup');
  });

  it('applyTranslations does not mutate the original object', () => {
    const original = { ...entity };
    applyTranslations(entity, ['name'], 'en');
    expect(entity.name).toBe(original.name);
  });

  it('applyTranslations falls back to source for missing translations', () => {
    const result = applyTranslations(entity, ['name'], 'de');
    expect(result.name).toBe('Борщ');
  });

  it('applyTranslationsMany applies to every item in array', () => {
    const items = [entity, { name: 'Піца', translations: { en: { name: { value: 'Pizza', isManual: false } } } }];
    const result = applyTranslationsMany(items, ['name'], 'en');
    expect(result[0].name).toBe('Borscht');
    expect(result[1].name).toBe('Pizza');
  });

  it('setTranslationEntry writes a manual entry correctly', () => {
    const t = {};
    setTranslationEntry(t, 'en', 'name', 'Borscht', true);
    expect(t.en.name).toEqual({ value: 'Borscht', isManual: true });
  });

  it('setTranslationEntry writes an auto entry correctly', () => {
    const t = {};
    setTranslationEntry(t, 'en', 'name', 'Borscht', false);
    expect(t.en.name.isManual).toBe(false);
  });

  it('otherLang returns the opposite language', () => {
    expect(otherLang('uk')).toBe('en');
    expect(otherLang('en')).toBe('uk');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. translationService — unit tests
// ════════════════════════════════════════════════════════════════════════════

describe('translateBatch', () => {
  it('calls Google Translate API with correct parameters', async () => {
    mockTranslate(['Borscht', 'Classic soup']);

    const result = await translateBatch(['Борщ', 'Класичний суп'], 'en', 'uk');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toContain('translation.googleapis.com');
    expect(url).toContain(process.env.GOOGLE_TRANSLATE_API_KEY);
    expect(body.target).toBe('en');
    expect(body.source).toBe('uk');
    expect(body.q).toEqual(['Борщ', 'Класичний суп']);

    expect(result).toEqual(['Borscht', 'Classic soup']);
  });

  it('returns empty array without calling API when texts is empty', async () => {
    const result = await translateBatch([], 'en', 'uk');
    expect(axios.post).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('returns empty strings and logs warning when API key is missing', async () => {
    const original = process.env.GOOGLE_TRANSLATE_API_KEY;
    delete process.env.GOOGLE_TRANSLATE_API_KEY;

    const result = await translateBatch(['Борщ'], 'en', 'uk');
    expect(axios.post).not.toHaveBeenCalled();
    expect(result).toEqual(['']);

    process.env.GOOGLE_TRANSLATE_API_KEY = original;
  });
});

describe('autoTranslateEntity', () => {
  it('translates non-manual fields and saves the document', async () => {
    const restaurant = await createRestaurant();
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({
      name: 'Борщ', description: 'Класичний', basePrice: 80,
      categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true,
    });

    mockTranslate(['Borscht', 'Classic']);

    await autoTranslateEntity(item, ['name', 'description'], 'uk');

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.en.name.value).toBe('Borscht');
    expect(updated.translations.en.name.isManual).toBe(false);
    expect(updated.translations.en.description.value).toBe('Classic');
  });

  it('does NOT overwrite a manual translation', async () => {
    const restaurant = await createRestaurant();
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
      translations: { en: { name: { value: 'My Custom Name', isManual: true } } },
    });

    // Only translate to English (the only enabled language) — which is already manual, so no API call
    await autoTranslateEntity(item, ['name'], 'uk', ['en']);

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.en.name.value).toBe('My Custom Name');
    expect(updated.translations.en.name.isManual).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('skips empty source fields', async () => {
    const restaurant = await createRestaurant();
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
      // description is empty
    });

    mockTranslate(['Borscht']);

    await autoTranslateEntity(item, ['name', 'description'], 'uk');

    // Only one string sent (name), description skipped
    const [, body] = axios.post.mock.calls[0];
    expect(body.q).toEqual(['Борщ']);
  });

  it('translates from English to Ukrainian when writtenLang is en', async () => {
    const restaurant = await createRestaurant();
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({
      name: 'Pizza', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
    });

    mockTranslate(['Піца']);

    await autoTranslateEntity(item, ['name'], 'en');

    const [, body] = axios.post.mock.calls[0];
    expect(body.source).toBe('en');
    expect(body.target).toBe('uk');

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.uk.name.value).toBe('Піца');
  });

  it('continues to next language when API call fails for one', async () => {
    const restaurant = await createRestaurant();
    const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
    });

    axios.post.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    await expect(autoTranslateEntity(item, ['name'], 'uk')).resolves.not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Public menu — ?lang= routing
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/:restaurantId/menu?lang=en', () => {
  async function seedTranslatedMenu(restaurantId) {
    const cat = await Category.create({
      name: 'Перші страви', sortOrder: 1, restaurantId,
      translations: { en: { name: { value: 'Starters', isManual: false } } },
    });
    const item = await MenuItem.create({
      name: 'Борщ', description: 'Класичний суп', basePrice: 80,
      categoryId: cat._id, restaurantId, isAvailable: true,
      translations: {
        en: {
          name:        { value: 'Borscht',      isManual: false },
          description: { value: 'Classic soup', isManual: false },
        },
      },
    });
    return { cat, item };
  }

  it('returns Ukrainian content by default (no lang param)', async () => {
    const restaurant = await createRestaurant();
    await seedTranslatedMenu(restaurant._id);

    const res = await request(app).get(`/api/${restaurant._id}/menu`);

    expect(res.status).toBe(200);
    const category = res.body.data[0];
    expect(category.name).toBe('Перші страви');
    expect(category.items[0].name).toBe('Борщ');
  });

  it('returns English content when lang=en', async () => {
    const restaurant = await createRestaurant();
    await seedTranslatedMenu(restaurant._id);

    const res = await request(app).get(`/api/${restaurant._id}/menu?lang=en`);

    expect(res.status).toBe(200);
    const category = res.body.data[0];
    expect(category.name).toBe('Starters');
    expect(category.items[0].name).toBe('Borscht');
    expect(category.items[0].description).toBe('Classic soup');
  });

  it('falls back to source name when English translation is missing', async () => {
    const restaurant = await createRestaurant();
    await Category.create({ name: 'Напої', sortOrder: 1, restaurantId: restaurant._id });
    await MenuItem.create({
      name: 'Вода', basePrice: 20,
      categoryId: (await Category.findOne({ restaurantId: restaurant._id }))._id,
      restaurantId: restaurant._id, isAvailable: true,
    });

    const res = await request(app).get(`/api/${restaurant._id}/menu?lang=en`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].items[0].name).toBe('Вода');  // fallback to Ukrainian
  });
});

describe('GET /api/:restaurantId/menu/items/:itemId?lang=en', () => {
  it('returns translated dish detail including ingredients and addons', async () => {
    const restaurant = await createRestaurant();
    const cat  = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    // Ingredients and addons are embedded subdocuments on MenuItem; name_en is the English name
    const item = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
      translations: { en: { name: { value: 'Borscht', isManual: false } } },
      ingredients: [{ name: 'Буряк', name_en: 'Beetroot' }],
      addons:      [{ name: 'Сметана', price: 10, name_en: 'Sour cream' }],
    });

    const res = await request(app).get(`/api/${restaurant._id}/menu/items/${item._id}?lang=en`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Borscht');
    expect(res.body.data.ingredients[0].name).toBe('Beetroot');
    expect(res.body.data.addons[0].name).toBe('Sour cream');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Admin translations CRUD endpoints
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/:restaurantId/admin/translations/:entityType/:entityId', () => {
  it('returns translations map and translatable fields for a MenuItem', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
      translations: { en: { name: { value: 'Borscht', isManual: false } } },
    });

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/translations/MenuItem/${item._id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.translations.en.name.value).toBe('Borscht');
    expect(res.body.data.translatableFields).toContain('name');
    expect(res.body.data.translatableFields).toContain('description');
    expect(res.body.data.supportedLanguages).toContain('uk');
    expect(res.body.data.supportedLanguages).toContain('en');
  });

  it('returns 404 for unknown entity type', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/translations/UnknownModel/000000000000000000000000`)
      .set(authHeader(admin));

    expect(res.status).toBe(404);
  });

  it('returns 403 for waiter', async () => {
    const restaurant = await createRestaurant();
    const waiter = await createStaff('waiter', restaurant._id);
    const cat    = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });

    const res = await request(app)
      .get(`/api/${restaurant._id}/admin/translations/Category/${cat._id}`)
      .set(authHeader(waiter));

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/:restaurantId/admin/translations — set manual override', () => {
  it('sets manual translation and marks isManual true', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
    });

    const res = await request(app)
      .patch(`/api/${restaurant._id}/admin/translations`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: item._id, language: 'en', fields: { name: 'My Borscht' } });

    expect(res.status).toBe(200);

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.en.name.value).toBe('My Borscht');
    expect(updated.translations.en.name.isManual).toBe(true);
  });

  it('can set manual translation for a Category', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Салати', sortOrder: 1, restaurantId: restaurant._id });

    const res = await request(app)
      .patch(`/api/${restaurant._id}/admin/translations`)
      .set(authHeader(admin))
      .send({ entityType: 'Category', entityId: cat._id, language: 'en', fields: { name: 'Salads' } });

    expect(res.status).toBe(200);
    const updated = await Category.findById(cat._id).lean();
    expect(updated.translations.en.name.value).toBe('Salads');
    expect(updated.translations.en.name.isManual).toBe(true);
  });

  it('returns 400 for unsupported language', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
    });

    const res = await request(app)
      .patch(`/api/${restaurant._id}/admin/translations`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: item._id, language: 'zh', fields: { name: '罗宋汤' } });

    expect(res.status).toBe(400);
  });

  it('returns 400 when fields object contains no valid translatable keys', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });

    const res = await request(app)
      .patch(`/api/${restaurant._id}/admin/translations`)
      .set(authHeader(admin))
      .send({ entityType: 'Category', entityId: cat._id, language: 'en', fields: { price: 999 } });

    expect(res.status).toBe(400);
  });

  it('returns 400 when required body fields are missing', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .patch(`/api/${restaurant._id}/admin/translations`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem' }); // missing entityId, language, fields

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/:restaurantId/admin/translations/manual-override', () => {
  it('sets isManual to false so auto-translate can overwrite on next trigger', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
      translations: { en: { name: { value: 'My Borscht', isManual: true } } },
    });

    const res = await request(app)
      .delete(`/api/${restaurant._id}/admin/translations/manual-override`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: item._id, language: 'en', fields: ['name'] });

    expect(res.status).toBe(200);

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.en.name.value).toBe('My Borscht');  // value kept
    expect(updated.translations.en.name.isManual).toBe(false);       // but now auto-translatable
  });

  it('returns 400 when fields array is missing', async () => {
    const restaurant = await createRestaurant();
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .delete(`/api/${restaurant._id}/admin/translations/manual-override`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: '000000000000000000000000', language: 'en' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/:restaurantId/admin/translations/auto-translate', () => {
  it('translates all non-manual fields and saves to DB', async () => {
    const restaurant = await createRestaurant({ plan: 'premium', enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', description: 'Класичний суп', basePrice: 80,
      categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true,
    });

    mockTranslate(['Borscht', 'Classic soup']);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/translations/auto-translate`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: item._id, writtenLang: 'uk' });

    expect(res.status).toBe(200);

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.en.name.value).toBe('Borscht');
    expect(updated.translations.en.description.value).toBe('Classic soup');
    expect(updated.translations.en.name.isManual).toBe(false);
  });

  it('does not translate manually overridden fields', async () => {
    const restaurant = await createRestaurant({ plan: 'premium', enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', description: 'Класичний суп', basePrice: 80,
      categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true,
      translations: { en: { name: { value: 'My Borscht', isManual: true } } },
    });

    // Only description should be translated
    mockTranslate(['Classic soup']);

    await request(app)
      .post(`/api/${restaurant._id}/admin/translations/auto-translate`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: item._id, writtenLang: 'uk' });

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.en.name.value).toBe('My Borscht'); // untouched
    expect(updated.translations.en.description.value).toBe('Classic soup');

    // API was called with only description
    const [, body] = axios.post.mock.calls[0];
    expect(body.q).toEqual(['Класичний суп']);
  });

  it('translates from English to Ukrainian when writtenLang is en', async () => {
    const restaurant = await createRestaurant({ plan: 'premium', enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Test', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Pizza', basePrice: 100, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
    });

    mockTranslate(['Піца']);

    await request(app)
      .post(`/api/${restaurant._id}/admin/translations/auto-translate`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: item._id, writtenLang: 'en' });

    const [, body] = axios.post.mock.calls[0];
    expect(body.source).toBe('en');
    expect(body.target).toBe('uk');

    const updated = await MenuItem.findById(item._id).lean();
    expect(updated.translations.uk.name.value).toBe('Піца');
  });

  it('returns 400 for unknown entityType', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/translations/auto-translate`)
      .set(authHeader(admin))
      .send({ entityType: 'Invoice', entityId: '000000000000000000000000' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when entity does not exist', async () => {
    const restaurant = await createRestaurant({ plan: 'premium' });
    const admin = await createStaff('admin', restaurant._id);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/translations/auto-translate`)
      .set(authHeader(admin))
      .send({ entityType: 'MenuItem', entityId: '000000000000000000000000' });

    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Admin menu create / update triggers auto-translate
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/:restaurantId/admin/menu/items — triggers auto-translate', () => {
  it('stores manual translation for written language on create', async () => {
    const restaurant = await createRestaurant({ enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });

    mockTranslate(['Borscht', 'Classic soup']);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items`)
      .set(authHeader(admin))
      .send({ name: 'Борщ', description: 'Класичний суп', price: 80, categoryId: cat._id, lang: 'uk' });

    expect(res.status).toBe(201);
    const item = await MenuItem.findById(res.body.data._id).lean();
    // Written language stored as manual immediately (sync)
    expect(item.translations.uk.name.isManual).toBe(true);
    expect(item.translations.uk.name.value).toBe('Борщ');
  });

  it('schedules auto-translate to the other language on create', async () => {
    const restaurant = await createRestaurant({ enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });

    mockTranslate(['Borscht', 'Classic soup']);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items`)
      .set(authHeader(admin))
      .send({ name: 'Борщ', description: 'Класичний суп', price: 80, categoryId: cat._id, lang: 'uk' });

    expect(res.status).toBe(201);

    // Let the fire-and-forget promise settle
    await flushAsync();

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, body] = axios.post.mock.calls[0];
    expect(body.source).toBe('uk');
    expect(body.target).toBe('en');
  });

  it('stores manual English translation when lang is en', async () => {
    const restaurant = await createRestaurant({ enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Test', sortOrder: 1, restaurantId: restaurant._id });

    mockTranslate(['Піца']);

    const res = await request(app)
      .post(`/api/${restaurant._id}/admin/menu/items`)
      .set(authHeader(admin))
      .send({ name: 'Pizza', price: 120, categoryId: cat._id, lang: 'en' });

    expect(res.status).toBe(201);
    const item = await MenuItem.findById(res.body.data._id).lean();
    expect(item.translations.en.name.isManual).toBe(true);
    expect(item.translations.en.name.value).toBe('Pizza');
  });
});

describe('PUT /api/:restaurantId/admin/menu/items/:itemId — triggers auto-translate on change', () => {
  it('re-translates only changed fields on update', async () => {
    const restaurant = await createRestaurant({ enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', description: 'Стара', basePrice: 80,
      categoryId: cat._id, restaurantId: restaurant._id, isAvailable: true,
    });

    // Only name changes — only name should be sent to Google
    mockTranslate(['New Borscht']);

    await request(app)
      .put(`/api/${restaurant._id}/admin/menu/items/${item._id}`)
      .set(authHeader(admin))
      .send({ name: 'Новий Борщ', lang: 'uk' });

    await flushAsync();

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, body] = axios.post.mock.calls[0];
    expect(body.q).toEqual(['Новий Борщ']);   // only name, not description
  });

  it('does not call Google Translate when no translatable field changed', async () => {
    const restaurant = await createRestaurant({ enabledLanguages: ['uk', 'en'] });
    const admin = await createStaff('admin', restaurant._id);
    const cat   = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId: restaurant._id });
    const item  = await MenuItem.create({
      name: 'Борщ', basePrice: 80, categoryId: cat._id,
      restaurantId: restaurant._id, isAvailable: true,
    });

    await request(app)
      .put(`/api/${restaurant._id}/admin/menu/items/${item._id}`)
      .set(authHeader(admin))
      .send({ price: 100, isAvailable: false });   // non-translatable fields only

    await flushAsync();

    expect(axios.post).not.toHaveBeenCalled();
  });
});
