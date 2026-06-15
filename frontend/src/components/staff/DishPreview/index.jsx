import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './dishPreview.module.css';

export default function DishPreview({ dish, available }) {
  const { t } = useTranslation('components');
  const local = useLocalField();

  const rawImg = dish?.images?.[dish?.selectedImageIdx ?? 0] ?? dish?.images?.[0];
  const imgSrc = typeof rawImg === 'string' ? rawImg : rawImg?.url ?? null;

  return (
    <div className={styles.wrapper}>
      <p className={styles.title}>{t('preview')}</p>
      <div className={styles.card}>
        {imgSrc ? (
          <img src={imgSrc} alt="" className={styles.img} />
        ) : (
          <div className={styles.imgPlaceholder}>🍽</div>
        )}
        <div className={styles.body}>
          <p className={styles.name}>{local(dish, 'name') || '—'}</p>
          <p className={styles.desc}>{local(dish, 'description') || '—'}</p>
          <p className={styles.price}>
            {dish?.price ? `${dish.price} ${t('currency_symbol', '₴')}` : '—'}
          </p>
        </div>
      </div>
      <div className={styles.availRow}>
        <span className={styles.availLabel}>{t('available')}</span>
        <div className={`${styles.toggle} ${available ? styles.toggleOn : ''}`}>
          <span className={styles.toggleThumb} />
        </div>
      </div>
    </div>
  );
}