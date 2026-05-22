import React from 'react';
import { createPortal } from 'react-dom';
import { MdAutoAwesome } from 'react-icons/md';
import styles from './translateOverlay.module.css';

/**
 * Full-viewport overlay shown while auto-translate is running.
 * Rendered into document.body via portal so it sits above StaffShell layout.
 *
 * Props:
 *   visible  boolean — whether to show
 *   lang     string  — target language label (e.g. "English")
 */
export default function TranslateOverlay({ visible, lang }) {
  if (!visible) return null;

  return createPortal(
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <MdAutoAwesome className={styles.icon} />
          <span className={styles.ripple} />
        </div>
        <p className={styles.title}>Перекладаємо…</p>
        {lang && <p className={styles.sub}>Google Translate → {lang}</p>}
        <div className={styles.dots}>
          <span /><span /><span />
        </div>
      </div>
    </div>,
    document.body,
  );
}
