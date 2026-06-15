/**
 * Google Cloud Translation v2 (Basic) wrapper.
 *
 * Env required:
 *   GOOGLE_TRANSLATE_API_KEY
 *
 * Both supported languages are equal — translation direction is determined by
 * which language the admin wrote in (`writtenLang`).
 */

const axios = require('axios');
const { LANGUAGES }           = require('../config/i18n');
const { setTranslationEntry } = require('../utils/translatedField');

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// ── Low-level API call ───────────────────────────────────────────────────────

/**
 * Translate an array of strings from `sourceLang` to `targetLang`.
 * Returns translated strings in the same order.
 */
async function translateBatch(texts, targetLang, sourceLang) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) {
    console.warn('[translationService] GOOGLE_TRANSLATE_API_KEY not set — skipping');
    return texts.map(() => '');
  }
  if (!texts.length) return [];

  const { data } = await axios.post(`${ENDPOINT}?key=${key}`, {
    q:      texts,
    target: targetLang,
    source: sourceLang,
    format: 'text',
  });

  return data.data.translations.map(t => t.translatedText);
}

// ── High-level entity translation ────────────────────────────────────────────

/**
 * Auto-translate all non-manual fields of a Mongoose document to every
 * language OTHER than `writtenLang`, then persist the document.
 *
 * Only fields where:
 *   • the source value is non-empty, AND
 *   • translations[targetLang][field].isManual !== true
 * will be translated.
 *
 * @param {mongoose.Document} entity             Full Mongoose doc (not lean)
 * @param {string[]}          translatableFields e.g. ['name', 'description']
 * @param {string}            writtenLang        Language the admin typed in
 * @param {string[]|null}     enabledLanguages   Restaurant's enabled languages;
 *                                               null/[] means use all SUPPORTED_LANGUAGES
 */
async function autoTranslateEntity(entity, translatableFields, writtenLang, enabledLanguages = null) {
  const pool = enabledLanguages?.length ? enabledLanguages : LANGUAGES;
  const targetLanguages = pool.filter(l => l !== writtenLang);
  if (!targetLanguages.length) return;

  const translations = entity.translations
    ? JSON.parse(JSON.stringify(entity.translations))
    : {};

  let changed = false;

  for (const targetLang of targetLanguages) {
    const fieldsToTranslate = translatableFields.filter(field => {
      const existing = translations[targetLang]?.[field];
      return entity[field] && !existing?.isManual;   // skip empty + manual
    });

    if (!fieldsToTranslate.length) continue;

    const sourceTexts = fieldsToTranslate.map(f => entity[f]);

    let translated;
    try {
      translated = await translateBatch(sourceTexts, targetLang, writtenLang);
    } catch (err) {
      console.error(`[translationService] Failed to translate to "${targetLang}":`, err.message);
      continue;
    }

    fieldsToTranslate.forEach((field, i) => {
      setTranslationEntry(translations, targetLang, field, translated[i], false);
    });
    changed = true;
  }

  if (changed) {
    entity.translations = translations;
    entity.markModified('translations');
    await entity.save();
  }
}

/**
 * Fire-and-forget wrapper — call inside request handlers to avoid
 * blocking the HTTP response.
 */
function scheduleAutoTranslate(entity, translatableFields, writtenLang, enabledLanguages = null) {
  autoTranslateEntity(entity, translatableFields, writtenLang, enabledLanguages)
    .catch(err => console.error('[translationService] Background error:', err.message));
}

module.exports = { translateBatch, autoTranslateEntity, scheduleAutoTranslate };
