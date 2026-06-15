/**
 * i18n configuration.
 *
 * SUPPORTED_LANGUAGES is the master list of every language the system knows about.
 * To add a new language: append an entry here — no other code changes required.
 *
 * Per-restaurant enabledLanguages (stored in Restaurant.enabledLanguages) controls
 * which languages are auto-translated for that restaurant.
 * An empty enabledLanguages array means "use all SUPPORTED_LANGUAGES".
 */
const SUPPORTED_LANGUAGES = [
  { code: 'uk', name: 'Українська' },
  { code: 'en', name: 'English' },
  { code: 'pl', name: 'Polski' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'cs', name: 'Čeština' },
  { code: 'sk', name: 'Slovenčina' },
];

const LANGUAGES = SUPPORTED_LANGUAGES.map(l => l.code);

function isSupported(code) {
  return LANGUAGES.includes(code);
}

module.exports = { LANGUAGES, SUPPORTED_LANGUAGES, isSupported };
