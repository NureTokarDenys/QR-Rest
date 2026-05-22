import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import { Skel } from '../Skeleton';
import styles from './menuDishRow.module.css';
import { MdEdit } from "react-icons/md";
import { MdDelete } from "react-icons/md";

export default function MenuDishRow({ dish, dish_category, onToggle, onDelete }) {
  const navigate = useNavigate();
  const { t } = useTranslation('components');
  const local = useLocalField();

  return (
    <tr className={styles.row}>
      <td className={styles.dishCell}>
        <div className={styles.dishInfo}>
          <img src={dish.image} alt={local(dish, 'name')} className={styles.image} />
          <span className={styles.name}>{local(dish, 'name')}</span>
        </div>
      </td>
      <td className={styles.cell}>
        <span
          className={styles.catBadge}
          style={dish_category?.color ? {
            background: `${dish_category.color}22`,
            color:       dish_category.color,
            border:      `1px solid ${dish_category.color}55`,
          } : undefined}
        >
          {local(dish_category, 'name')}
        </span>
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
          <MdEdit className={styles.editIcon} />
          </button>
          <button
            className={styles.deleteBtn}
            onClick={() => onDelete && onDelete(dish.id)}
            aria-label={t('delete')}
          >
          <MdDelete className={styles.deleteIcon} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Skeleton row — mirrors the real <MenuDishRow> structure (image + name,
 * category badge, price, toggle, edit/delete) so every grey block lands in
 * the same cell as its real counterpart.
 */
export function MenuDishRowSkeleton({ nameWidth = 140 }) {
  return (
    <tr className={styles.row}>
      <td className={styles.dishCell}>
        <div className={styles.dishInfo}>
          <Skel w={36} h={36} r={8} />
          <Skel w={nameWidth} h={14} />
        </div>
      </td>
      <td className={styles.cell}>
        <Skel w={120} h={22} r={6} />
      </td>
      <td className={`${styles.cell} ${styles.price}`}>
        <Skel w={50} h={16} />
      </td>
      <td className={styles.cell}>
        <Skel w={36} h={20} r={10} />
      </td>
      <td className={styles.cell}>
        <div className={styles.actions}>
          <Skel w={24} h={24} r={6} />
          <Skel w={24} h={24} r={6} />
        </div>
      </td>
    </tr>
  );
}