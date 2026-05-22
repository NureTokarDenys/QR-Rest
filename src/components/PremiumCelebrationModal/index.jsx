import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MdCheckCircle } from 'react-icons/md';
import styles from './premiumCelebrationModal.module.css';

const FEATURES = [
  'celebrationFeature1',
  'celebrationFeature2',
  'celebrationFeature3',
  'celebrationFeature4',
  'celebrationFeature5',
  'celebrationFeature6',
  'celebrationFeature7',
];

export default function PremiumCelebrationModal({ open, onClose }) {
  const { t } = useTranslation('restaurantSettings');

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>

        {/* Animated sparkles */}
        <div className={styles.sparkles} aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className={styles.sparkle} style={{ '--i': i }} />
          ))}
        </div>

        {/* Crown */}
        <div className={styles.crownWrap} aria-hidden="true">
          <span className={styles.crown}>👑</span>
        </div>

        <h2 className={styles.title}>{t('celebrationTitle')}</h2>
        <p className={styles.subtitle}>{t('celebrationSubtitle')}</p>

        <ul className={styles.features}>
          {FEATURES.map((key, i) => (
            <li key={key} className={styles.feature} style={{ '--delay': `${0.25 + i * 0.07}s` }}>
              <MdCheckCircle className={styles.featureIcon} />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>

        <button className={styles.cta} onClick={onClose} autoFocus>
          {t('celebrationCta')}
        </button>
      </div>
    </div>,
    document.body
  );
}
