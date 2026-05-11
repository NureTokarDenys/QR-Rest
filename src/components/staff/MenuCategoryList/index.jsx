import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './menuCategoryList.module.css';
import { MdEdit } from 'react-icons/md';

export default function MenuCategoryList({ categories, selected, onSelect, onAdd }) {
  const { t }    = useTranslation('components');
  const navigate = useNavigate();
  const local    = useLocalField();

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
          <span
            className={styles.colorDot}
            style={{ background: cat.color || 'var(--separator-color)' }}
          />
          <button
            className={`${styles.item} ${selected === cat.id ? styles.active : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            {local(cat, 'name')}
          </button>
          <button
            className={styles.icon}
            onClick={() => navigate(`/staff/menu/category/${cat.id}`)}
            aria-label={t('edit')}
          >
            <MdEdit className={styles.editIcon} />
          </button>
        </div>
      ))}

      <button className={styles.addBtn} onClick={onAdd}>{t('newCategory')}</button>
    </div>
  );
}
