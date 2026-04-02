import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './shiftStats.module.css';

export default function ShiftStats({ stats }) {
  const { t } = useTranslation('tableMap');

  const rows = [
    { label: t('orders'),    value: stats.orders },
    { label: t('completed'), value: stats.completed },
    { label: t('revenue'),   value: `${stats.revenue}₴` },
    { label: t('avgCheck'),  value: `${stats.avgCheck}₴` },
  ];

  return (
    <div className={styles.wrapper}>
      {rows.map((row, i) => (
        <div key={i} className={styles.row}>
          <span className={styles.label}>{row.label}</span>
          <span className={styles.value}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}