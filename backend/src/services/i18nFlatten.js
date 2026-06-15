/**
 * Backend helper that takes a lean Mongo doc with a `translations` object
 * (Pattern B in project_summary) and returns a copy with flat `<field>_<lang>`
 * keys injected (Pattern A). Lets the frontend read e.g. `cat.name_en`
 * directly via `useLocalField` without having to know about the nested
 * `translations.en.name.value` shape.
 *
 *   const out = flattenTranslations(category, ['name']);
 *   // out.name_en === category.translations.en.name.value || category.name
 *
 * If `translations` is missing or empty, the function still injects fallbacks
 * so the frontend always finds a non-empty value (falls back to the source
 * field).
 */

const SUPPORTED_LANGS = ['en']; // extend here when new langs come online

function flattenTranslations(doc, fields = ['name']) {
  if (!doc) return doc;
  const out = { ...doc };
  for (const field of fields) {
    const src = doc[field] ?? '';
    for (const lang of SUPPORTED_LANGS) {
      const tValue = doc.translations?.[lang]?.[field]?.value;
      out[`${field}_${lang}`] = tValue || src;
    }
  }
  return out;
}

/** Same as flattenTranslations but for an array of docs. */
function flattenTranslationsAll(docs, fields = ['name']) {
  if (!Array.isArray(docs)) return docs;
  return docs.map(d => flattenTranslations(d, fields));
}

module.exports = { flattenTranslations, flattenTranslationsAll };
