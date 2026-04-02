import React from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import TableMapItem from '../../../components/staff/TableMapItem';
import { TABLES } from '../../../data/mockData';
import styles from './tableMap.module.css';

import { MdMap } from "react-icons/md";


const LEGEND = [
  { className: 'free',   label_ua: 'Вільний',  label_en: 'Free' },
  { className: 'busy',   label_ua: 'Зайнятий', label_en: 'Busy' },
  { className: 'bill', label_ua: 'Рахунок',  label_en: 'Bill' },
  { className: 'waiter', label_ua: 'Виклик офіціанта', label_en: 'Waiter call' },
];

export default function TableMap() {
  const { t, i18n } = useTranslation('tableMap');
  const lang = i18n.language === 'en' ? 'en' : 'ua';

  return (
    <StaffShell title={`${<MdMap/>} ${t('title')}`}>
      <div className={styles.page}>
        <div className={styles.legendRow}>
          {LEGEND.map(l => (
            <div key={l.className} className={styles.legendItem}>
              <span className={`${styles.dot} ${styles[l.className]}`} />
              <span className={styles.legendLabel}>
                {lang === 'en' ? l.label_en : l.label_ua}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.hall}>
          <p className={styles.hallTitle}>{t('hallTitle')}</p>
          <div className={styles.tablesGrid}>
            {TABLES.map(table => (
              <div key={table.id} className={styles.tableSlot}>
                <TableMapItem table={table} />
              </div>
            ))}
          </div>
          <div className={styles.kitchenBtn}>
            <span className={styles.kitchenLabel}>{t('kitchen')}</span>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}