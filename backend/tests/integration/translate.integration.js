/**
 * tests/integration/translate.integration.js
 *
 * Real Google Translate API integration test — run manually:
 *   node tests/integration/translate.integration.js
 *
 * Reads GOOGLE_TRANSLATE_API_KEY from .env.
 * Makes actual HTTP calls to the Google Cloud Translation API v2.
 *
 * Tests:
 *   1. Single string translation (uk → en)
 *   2. Batch translation — multiple strings in one API call
 *   3. Reverse direction (en → uk)
 *   4. autoTranslateEntity — full entity translate + in-memory DB save
 *   5. Manual override respected — isManual fields are never overwritten
 *   6. HTML entities handling — Google returns &amp; etc., verify clean output
 */

'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// ─── config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

if (!API_KEY || API_KEY === 'your_google_translate_api_key') {
  console.error('❌  GOOGLE_TRANSLATE_API_KEY is not set in .env');
  process.exit(1);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(` ${title}`);
  console.log('─'.repeat(60));
}

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label, reason) {
  console.log(`  ❌  ${label}`);
  console.log(`       ${reason}`);
  failed++;
  failures.push({ label, reason });
}

function assert(condition, label, detail = '') {
  if (condition) ok(label);
  else fail(label, detail || 'Assertion failed');
}

// ─── import services after dotenv loaded ─────────────────────────────────────

const { translateBatch, autoTranslateEntity } = require('../../src/services/translationService');

// ─── test cases ──────────────────────────────────────────────────────────────

async function test1_singleString() {
  section('1 / 6  —  Single string  uk → en');

  const [result] = await translateBatch(['Борщ'], 'en', 'uk');
  console.log(`  Input  : "Борщ"`);
  console.log(`  Output : "${result}"`);

  assert(typeof result === 'string' && result.length > 0, 'Returns a non-empty string');
  assert(result.toLowerCase().includes('borscht') || result.toLowerCase().includes('borsch'),
    'Translation contains "borscht"', `Got: "${result}"`);
}

async function test2_batchTranslation() {
  section('2 / 6  —  Batch translation  uk → en');

  const inputs = ['Салат', 'Піца', 'Стейк', 'Десерт'];
  const results = await translateBatch(inputs, 'en', 'uk');

  console.log('  Input  → Output');
  inputs.forEach((inp, i) => console.log(`  "${inp}" → "${results[i]}"`));

  assert(results.length === inputs.length, `Returns ${inputs.length} translations`);
  assert(results.every(r => typeof r === 'string' && r.length > 0), 'All results are non-empty strings');
  assert(results[1].toLowerCase().includes('pizza'), 'Pizza translates correctly', `Got: "${results[1]}"`);
}

async function test3_reverseDirection() {
  section('3 / 6  —  Reverse direction  en → uk');

  const inputs = ['Soup', 'Salad', 'Dessert'];
  const results = await translateBatch(inputs, 'uk', 'en');

  console.log('  Input  → Output');
  inputs.forEach((inp, i) => console.log(`  "${inp}" → "${results[i]}"`));

  assert(results.length === inputs.length, 'Returns correct count');
  // Verify results contain Cyrillic characters
  assert(results.every(r => /[Ѐ-ӿ]/.test(r)), 'All results contain Cyrillic characters');
}

async function test4_autoTranslateEntity() {
  section('4 / 6  —  autoTranslateEntity  (MenuItem  uk → en)');

  // Build a minimal Mongoose-like document using the real MenuItem model
  const MenuItem = require('../../src/models/MenuItem');
  const Category = require('../../src/models/Category');

  const restaurantId = 'INTTEST1';

  const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId });
  const item = await MenuItem.create({
    name:        'Вареники з картоплею',
    description: 'Традиційна українська страва з тіста з начинкою',
    basePrice:   95,
    categoryId:  cat._id,
    restaurantId,
    isAvailable: true,
  });

  console.log(`  Source name        : "${item.name}"`);
  console.log(`  Source description : "${item.description}"`);

  await autoTranslateEntity(item, ['name', 'description'], 'uk');

  const updated = await MenuItem.findById(item._id).lean();
  const enName  = updated.translations?.en?.name?.value;
  const enDesc  = updated.translations?.en?.description?.value;

  console.log(`  Translated name    : "${enName}"`);
  console.log(`  Translated desc    : "${enDesc}"`);

  assert(typeof enName === 'string' && enName.length > 0, 'name translation saved to DB');
  assert(typeof enDesc === 'string' && enDesc.length > 0, 'description translation saved to DB');
  assert(updated.translations?.en?.name?.isManual === false, 'name isManual = false (auto)');
  assert(updated.translations?.en?.description?.isManual === false, 'description isManual = false (auto)');
}

async function test5_manualOverrideRespected() {
  section('5 / 6  —  Manual override not overwritten');

  const MenuItem = require('../../src/models/MenuItem');
  const Category = require('../../src/models/Category');

  const restaurantId = 'INTTEST2';
  const cat = await Category.create({ name: 'Тест', sortOrder: 1, restaurantId });
  const item = await MenuItem.create({
    name:        'Борщ',
    description: 'Класичний суп',
    basePrice:   80,
    categoryId:  cat._id,
    restaurantId,
    isAvailable: true,
    translations: {
      en: {
        name:        { value: 'My Custom Borscht', isManual: true  },
        description: { value: '',                  isManual: false },
      },
    },
  });

  console.log(`  Manual name set to : "My Custom Borscht"`);

  await autoTranslateEntity(item, ['name', 'description'], 'uk');

  const updated = await MenuItem.findById(item._id).lean();
  const enName  = updated.translations?.en?.name?.value;
  const enDesc  = updated.translations?.en?.description?.value;

  console.log(`  Name after translate  : "${enName}"  (should be unchanged)`);
  console.log(`  Desc after translate  : "${enDesc}"  (should be translated)`);

  assert(enName === 'My Custom Borscht', 'Manual name preserved', `Got: "${enName}"`);
  assert(typeof enDesc === 'string' && enDesc.length > 0, 'Auto description was translated');
  assert(updated.translations?.en?.name?.isManual === true, 'name isManual still true');
}

async function test6_htmlEntities() {
  section('6 / 6  —  Multiple dishes batch (stress)');

  const dishes = [
    'Суп-пюре з гарбуза',
    'М\'ясо по-французьки',
    'Салат «Олів\'є»',
    'Відбивна зі свинини',
    'Картопля фрі',
  ];

  const results = await translateBatch(dishes, 'en', 'uk');

  console.log('  Input  → Output');
  dishes.forEach((d, i) => console.log(`  "${d}" → "${results[i]}"`));

  assert(results.length === dishes.length, `All ${dishes.length} dishes translated`);
  assert(results.every(r => typeof r === 'string' && r.length > 0), 'All results non-empty');
  // Verify no raw HTML entity codes leaked through (common Google Translate issue)
  const hasRawEntities = results.some(r => /&amp;|&lt;|&gt;|&#\d+;/.test(r));
  assert(!hasRawEntities, 'No raw HTML entities in output', `Results: ${JSON.stringify(results)}`);
}

// ─── run ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🌐  Google Translate API integration test');
  console.log(`API key : ${API_KEY.slice(0, 16)}…`);

  // Start in-memory MongoDB for autoTranslateEntity tests
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const tests = [
    test1_singleString,
    test2_batchTranslation,
    test3_reverseDirection,
    test4_autoTranslateEntity,
    test5_manualOverrideRespected,
    test6_htmlEntities,
  ];

  try {
    for (const test of tests) {
      try {
        await test();
      } catch (err) {
        fail(test.name, err.message);
        if (err.response?.data?.error) {
          console.log(`       Google: ${err.response.data.error.message}`);
        }
      }
    }
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
  }

  section('Results');
  console.log(`  Passed : ${passed}`);
  console.log(`  Failed : ${failed}`);

  if (failures.length) {
    console.log('\n  Failed tests:');
    failures.forEach(f => console.log(`    • ${f.label} — ${f.reason}`));
    console.log();
    process.exit(1);
  }

  console.log('\n✅  All Google Translate integration tests passed.\n');
}

run().catch((err) => {
  console.error('\n❌  Runner crashed unexpectedly:', err.message);
  process.exit(1);
});
