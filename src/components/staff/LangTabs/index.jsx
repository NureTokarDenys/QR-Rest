import React from 'react';
import { MdAutoAwesome } from 'react-icons/md';
import { SOURCE_LANG } from '../../../i18n/langs';
import styles from './langTabs.module.css';

/**
 * LangTabs — language switcher strip used inside DishEdit.
 *
 * Props:
 *   langs       SUPPORTED_LANGS array
 *   active      currently active lang code ('ua' | 'en' | ...)
 *   onChange    (code) => void
 *   onTranslate () => void  — called when admin clicks "Translate from UA"
 *                            pass null/undefined to hide the button
 *   translating boolean — shows spinner text while translating
 */
export default function LangTabs({ langs, active, onChange, onTranslate, translating }) {
  const isSource = active === SOURCE_LANG;
  const sourceLang = langs.find(l => l.code === SOURCE_LANG);

  return (
    <div className={styles.bar}>
      {/* Tab pills */}
      <div className={styles.tabs}>
        {langs.map(l => (
          <button
            key={l.code}
            type="button"
            className={`${styles.tab} ${active === l.code ? styles.active : ''}`}
            onClick={() => onChange(l.code)}
          >
            <span className={styles.flag}>{l.flag}</span>
            {l.label}
          </button>
        ))}
      </div>

      {/* Auto-translate button — only visible on non-source tabs */}
      {!isSource && onTranslate && (
        <button
          type="button"
          className={styles.translateBtn}
          onClick={onTranslate}
          disabled={translating}
          title={`Перекласти всі поля з ${sourceLang?.label} за допомогою Google Translate`}
        >
          <MdAutoAwesome className={styles.translateIcon} />
          {translating
            ? 'Перекладаємо…'
            : `Перекласти з ${sourceLang?.label}`}
        </button>
      )}
    </div>
  );
}
