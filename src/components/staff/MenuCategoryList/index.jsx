import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './menuCategoryList.module.css';

export default function MenuCategoryList({ categories, selected, onSelect, onAdd }) {
  const { t } = useTranslation('menuManagement');

  return (
    <div className={styles.wrapper}>
      <p className={styles.header}>{t('categories')}</p>
      <button
        className={`${styles.item} ${selected === 'all' ? styles.active : ''}`}
        onClick={() => onSelect('all')}
      >
        {t('all')}
      </button>
      {categories.map(cat => (
        <div key={cat.id} className={styles.catRow}>
          <button
            className={`${styles.item} ${selected === cat.id ? styles.active : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            {cat.name}
          </button>
          <button className={styles.icon}>✏️</button>
        </div>
      ))}
      <button className={styles.addBtn} onClick={onAdd}>{t('newCategory')}</button>
    </div>
  );
}