import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './tableDishList.module.css';

const STATUS_STYLES = {
  waiting: { bg: '#e8f4ff', color: '#1d7afc', icon: '⏳' },
  cooking: { bg: '#fff3e0', color: '#f57c00', icon: '🔥' },
  ready:   { bg: '#e8f5e9', color: '#2e7d32', icon: '✅' },
  served:  { bg: '#e8f5e9', color: '#2e7d32', icon: '✓' },
};

export default function TableDishList({ dishes }) {
  const { t } = useTranslation('tableDetail');
  const local = useLocalField();

  return (
    <div className={styles.box}>
      <p className={styles.title}>СТРАВИ</p>
      {dishes.map((d, i) => {
        const s = STATUS_STYLES[d.status] || STATUS_STYLES.waiting;
        return (
          <div key={i} className={styles.row}>
            <span className={styles.name}>{local(d, 'name')}</span>
            <span className={styles.badge} style={{ background: s.bg, color: s.color }}>
              {s.icon} {d.status === 'waiting' ? 'Очікує' : d.status === 'cooking' ? 'Готується' : 'Готово'}
            </span>
          </div>
        );
      })}
    </div>
  );
}