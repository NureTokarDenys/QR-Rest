import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './menuDishRow.module.css';

export default function MenuDishRow({ dish, onToggle, onDelete }) {
  const navigate = useNavigate();
  const { t } = useTranslation('components');
  const local = useLocalField();

  return (
    <tr className={styles.row}>
      <td className={styles.dishCell}>
        <div className={styles.dishInfo}>
          <div className={styles.thumb}>🍽</div>
          <span className={styles.name}>{local(dish, 'name')}</span>
        </div>
      </td>
      <td className={styles.cell}>
        <span className={styles.catBadge}>{local(dish, 'categoryName')}</span>
      </td>
      <td className={`${styles.cell} ${styles.price}`}>
        {dish.price} {t('currency_symbol', '₴')}
      </td>
      <td className={styles.cell}>
        <button
          className={`${styles.toggle} ${dish.available ? styles.toggleOn : ''}`}
          onClick={() => onToggle && onToggle(dish.id)}
        >
          <span className={styles.toggleThumb} />
        </button>
      </td>
      <td className={styles.cell}>
        <div className={styles.actions}>
          <button
            className={styles.editBtn}
            onClick={() => navigate(`/staff/menu/dish/${dish.id}`)}
            aria-label={t('edit')}
          >
            ✏️
          </button>
          <button
            className={styles.deleteBtn}
            onClick={() => onDelete && onDelete(dish.id)}
            aria-label={t('delete')}
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  );
}