import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './categoryCard.module.css';
import { useLocalField, useFallbackField } from '../../../i18n/useLang';
import { useTranslation } from 'react-i18next';
import FallbackMark from '../../FallbackMark';

export default function CategoryCard({ cat, onClick }) {
  const navigate = useNavigate();
  const { t } = useTranslation('category');
  const { t: tMenu } = useTranslation('menu');
  const local = useLocalField();
  const fb = useFallbackField();

  const { value: catName, isFallback: nameFallback } = fb(cat, 'name');

  return (
    <div className={styles.card} onClick={() => onClick ? onClick(cat) : navigate(`/category/${cat.id}`)}>
      <img src={cat.image} alt={local(cat, 'name')} className={styles.image} />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <span className={styles.name}>
          {catName}
          {nameFallback && <FallbackMark tip={tMenu('fallback_tooltip')} />}
        </span>
        <span className={styles.count}>
          {cat.count} {t('dish', { count: cat.count })}
        </span>
      </div>
    </div>
  );
}