/**
 * Utilities for the standardised `translations` field.
 *
 * Both supported languages (uk / en) are stored as equal entries:
 * {
 *   uk: { name: { value: 'Борщ',    isManual: true  },
 *          description: { value: '...', isManual: true  } },
 *   en: { name: { value: 'Borscht', isManual: false },
 *          description: { value: '...', isManual: false } },
 * }
 *
 * isManual: true  → admin wrote this value; auto-translate will NEVER overwrite it
 * isManual: false → auto-translated; overwritten whenever the source field changes
 *
 * The original `name` / `description` field on the document is kept as the
 * legacy / fallback value for rows created before i18n was added.
 */

const { LANGUAGES } = require('../config/i18n');

// ── Mongoose schema fragment ─────────────────────────────────────────────────

function translationsField() {
  const mongoose = require('mongoose');
  return { type: mongoose.Schema.Types.Mixed, default: {} };
}

// ── Resolution helpers ───────────────────────────────────────────────────────

/**
 * Return the best available value for `field` in `lang`.
 *
 * Priority:
 *   1. translations[lang][field].value     (requested language — auto or manual)
 *   2. translations[defaultLang][field].value  (default language translation, if lang ≠ defaultLang)
 *   3. entity[field]                       (legacy / original source value, always in default lang)
 *   4. ''
 *
 * Passing defaultLang makes the chain explicit for restaurants with 3+ languages:
 * a missing Polish translation falls to the English/Ukrainian translation entry
 * rather than directly to the raw field.
 */
function resolveField(entity, field, lang, defaultLang = null) {
  const entry = entity.translations?.[lang]?.[field];
  if (entry?.value) return entry.value;

  if (defaultLang && defaultLang !== lang) {
    const defaultEntry = entity.translations?.[defaultLang]?.[field];
    if (defaultEntry?.value) return defaultEntry.value;
  }

  return entity[field] ?? '';
}

/**
 * Return a new plain object with `fields` replaced by their resolved values
 * for the requested language. Does not mutate the original.
 */
function applyTranslations(entity, fields, lang, defaultLang = null) {
  if (!entity) return entity;
  const out = { ...entity };
  for (const field of fields) {
    out[field] = resolveField(entity, field, lang, defaultLang);
  }
  return out;
}

/** Array variant of applyTranslations. */
function applyTranslationsMany(entities, fields, lang, defaultLang = null) {
  return entities.map(e => applyTranslations(e, fields, lang, defaultLang));
}

/**
 * Write one translation entry into the translations map.
 * Mutates `translations` in place.
 */
function setTranslationEntry(translations, lang, field, value, isManual = false) {
  if (!translations[lang])         translations[lang] = {};
  translations[lang][field] = { value, isManual };
}

/**
 * Mark the written language fields as manual in an existing translations map.
 * Used when the admin saves content — their input is always treated as authoritative.
 */
function markAsManual(translations, lang, fields, entity) {
  for (const field of fields) {
    if (entity[field] != null) {
      setTranslationEntry(translations, lang, field, entity[field], true);
    }
  }
}

/** Return the other supported language (for a 2-language system). */
function otherLang(lang) {
  return LANGUAGES.find(l => l !== lang) ?? LANGUAGES[0];
}

module.exports = {
  translationsField,
  resolveField,
  applyTranslations,
  applyTranslationsMany,
  setTranslationEntry,
  markAsManual,
  otherLang,
};
