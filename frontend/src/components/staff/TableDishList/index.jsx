import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './tableDishList.module.css';

import { STATUS_STYLES } from '../../../constants/mainConstants'; 

export default function TableDishList({ dishes }) {
  const { t } = useTranslation('components');
  const local = useLocalField();

  return (
    <div className={styles.box}>
      <p className={styles.title}>{t('dishes')}</p>
      {dishes.map((d, i) => {
        const s = STATUS_STYLES[d.status] || STATUS_STYLES.waiting;
        const statusKey = d.status || 'waiting'; 

        return (
          <div key={i} className={styles.row}>
            <span className={styles.name}>{local(d, 'name')}</span>
            <span className={styles.badge} style={{ background: s.bg, color: s.color }}>
              {s.icon} {t(`status_${statusKey}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}