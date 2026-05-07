import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, SOURCE_LANG, fieldFor } from './langs';

/**
 * useLocalField — returns a localiser function that picks the right
 * translated field from an object based on the currently active i18next
 * language.
 *
 * Works for any number of languages — not just the original two.
 *
 * Usage:
 *   const local = useLocalField();
 *   local(dish, 'name')        // → dish.name (ua) or dish.name_en (en) or dish.name_pl (pl)
 *   local(category, 'name')    // same pattern
 */
export function useLocalField() {
  const { i18n } = useTranslation();

  return (obj, field) => {
    if (!obj) return '';
    const lang = i18n.language;

    // Source language → bare field (e.g. 'name')
    if (lang === SOURCE_LANG) return obj[field] ?? '';

    // Check this lang's field first, then fall back to source
    const localKey = fieldFor(field, lang);
    return obj[localKey] ?? obj[field] ?? '';
  };
}

/**
 * useFallbackField — like useLocalField but also tells you whether the value
 * shown is the source-language fallback (i.e. no translation was set for the
 * current language).
 *
 * Returns a function:  (obj, field) → { value: string, isFallback: boolean }
 *
 * isFallback is true only when:
 *   • the current language is NOT the source language, AND
 *   • the language-specific field (e.g. name_en) is absent / empty, AND
 *   • the source-language field is non-empty (so there IS something to show)
 */
export function useFallbackField() {
  const { i18n } = useTranslation();

  return (obj, field) => {
    if (!obj) return { value: '', isFallback: false };
    const lang = i18n.language;

    if (lang === SOURCE_LANG) return { value: obj[field] ?? '', isFallback: false };

    const localKey = fieldFor(field, lang);
    const localVal = obj[localKey];
    if (localVal) return { value: localVal, isFallback: false };

    const sourceVal = obj[field] ?? '';
    return { value: sourceVal, isFallback: !!sourceVal };
  };
}

/**
 * useLang — returns just the current i18next language code.
 * Convenience wrapper to avoid importing useTranslation everywhere.
 */
export function useLang() {
  const { i18n } = useTranslation();
  return i18n.language;
}

/**
 * getLangDef — returns the SUPPORTED_LANGS entry for a given code,
 * or undefined if not found.
 */
export function getLangDef(code) {
  return SUPPORTED_LANGS.find(l => l.code === code);
}
