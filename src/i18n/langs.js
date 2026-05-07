/**
 * SUPPORTED_LANGS — single source of truth for all content languages.
 *
 * ┌─────────┬──────────┬────────────────────────────────────────────────────┐
 * │  code   │ apiCode  │ Notes                                              │
 * ├─────────┼──────────┼────────────────────────────────────────────────────┤
 * │ 'ua'    │ 'uk'     │ SOURCE language — form field has no suffix:        │
 * │         │          │   name (not name_ua). API uses 'uk' (ISO 639-1).   │
 * │ 'en'    │ 'en'     │ English                                            │
 * │ 'pl'    │ 'pl'     │ (backend-supported, uncomment to enable)           │
 * │ 'de'    │ 'de'     │ (backend-supported, uncomment to enable)           │
 * │ 'fr'    │ 'fr'     │ (backend-supported, uncomment to enable)           │
 * │ 'cs'    │ 'cs'     │ (backend-supported, uncomment to enable)           │
 * │ 'sk'    │ 'sk'     │ (backend-supported, uncomment to enable)           │
 * └─────────┴──────────┴────────────────────────────────────────────────────┘
 *
 * To add a new language — two steps:
 *   1. Uncomment (or add) the entry below.
 *   2. Add the corresponding i18n locale files under src/i18n/locales/<code>/
 *      (copy & translate the ua/ folder as a starting point).
 *
 * The first entry is always treated as the SOURCE language (the one admins
 * fill in first; all others are translated from it).
 */
export const SUPPORTED_LANGS = [
  { code: 'ua', apiCode: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', apiCode: 'en', label: 'English',    flag: '🇬🇧' },
  // { code: 'pl', apiCode: 'pl', label: 'Polski',     flag: '🇵🇱' },
  // { code: 'de', apiCode: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  // { code: 'fr', apiCode: 'fr', label: 'Français',   flag: '🇫🇷' },
  // { code: 'cs', apiCode: 'cs', label: 'Čeština',    flag: '🇨🇿' },
  // { code: 'sk', apiCode: 'sk', label: 'Slovenčina', flag: '🇸🇰' },
];

/** Code of the primary / source language (i18next code). */
export const SOURCE_LANG = SUPPORTED_LANGS[0].code;

// ── Code mapping helpers ──────────────────────────────────────────────────────

/**
 * Convert a frontend i18next lang code to the backend API lang code.
 *   toApiLang('ua') → 'uk'
 *   toApiLang('en') → 'en'
 *   toApiLang('pl') → 'pl'
 */
export function toApiLang(i18nCode) {
  return SUPPORTED_LANGS.find(l => l.code === i18nCode)?.apiCode ?? i18nCode;
}

/**
 * Convert a backend API lang code to the frontend i18next lang code.
 *   fromApiLang('uk') → 'ua'
 *   fromApiLang('en') → 'en'
 *   fromApiLang('pl') → 'pl'
 */
export function fromApiLang(apiCode) {
  return SUPPORTED_LANGS.find(l => l.apiCode === apiCode)?.code ?? apiCode;
}

// ── Field-key helpers ─────────────────────────────────────────────────────────

/**
 * Returns the form-field / API-field key for a given base name and i18n code.
 * The source language never gets a suffix — it stays as the bare field name
 * so that the DB schema stays compatible with pre-i18n data.
 *
 *   fieldFor('name', 'ua') → 'name'       (source — no suffix)
 *   fieldFor('name', 'en') → 'name_en'
 *   fieldFor('name', 'pl') → 'name_pl'
 */
export function fieldFor(base, lang) {
  return lang === SOURCE_LANG ? base : `${base}_${lang}`;
}

/**
 * Returns an object with empty-string values for every supported language
 * variant of the given field bases.
 *   emptyI18n('name')               → { name: '', name_en: '' }
 *   emptyI18n('name','description')
 *     → { name:'', name_en:'', description:'', description_en:'' }
 */
export function emptyI18n(...bases) {
  const obj = {};
  bases.forEach(base => {
    SUPPORTED_LANGS.forEach(l => { obj[fieldFor(base, l.code)] = ''; });
  });
  return obj;
}
