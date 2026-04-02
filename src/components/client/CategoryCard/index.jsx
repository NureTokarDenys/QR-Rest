import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './categoryCard.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { useTranslation } from 'react-i18next';

export default function CategoryCard({ cat }) {
  const navigate = useNavigate();
  const { t } = useTranslation('category');
  const local = useLocalField();

  return (
    <div className={styles.card} onClick={() => navigate(`/category/${cat.id}`)}>
      <img src={cat.image} alt={local(cat, 'name')} className={styles.image} />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <span className={styles.name}>{local(cat, 'name')}</span>
        <span className={styles.count}>
          {cat.count} {t('dish', { count: cat.count })}
        </span>
      </div>
    </div>
  );
}