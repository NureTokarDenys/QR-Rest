import React from 'react';
import { useLocalField } from '../../../i18n/useLang';
import styles from './topDishRow.module.css';

export default function TopDishRow({ dish }) {
  const local = useLocalField();

  return (
    <tr className={styles.row}>
      <td className={styles.cell}>{dish.num}</td>
      <td className={styles.cell}>{local(dish, 'name')}</td>
      <td className={styles.cell}>{dish.ordered}</td>
      <td className={`${styles.cell} ${styles.revenue}`}>{dish.revenue}₴</td>
      <td className={styles.cell}>
        <span className={styles.rating}>⭐ {dish.rating}</span>
      </td>
    </tr>
  );
}