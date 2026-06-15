import React from 'react';
import { useLocalField } from '../../../i18n/useLang';
import styles from './topCategoryItem.module.css';

export default function TopCategoryItem({ item }) {
  const local = useLocalField();

  return (
    <div className={styles.row}>
      <span className={styles.name}>{local(item, 'name')}</span>
      <div className={styles.barWrap}>
        <div className={styles.bar} style={{ width: `${item.pct}%`, background: item.color }} />
      </div>
      <span className={styles.pct}>{item.pct}%</span>
    </div>
  );
}