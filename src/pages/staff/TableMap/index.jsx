import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import TableMapItem from '../../../components/staff/TableMapItem';
import { getTables } from '../../../api/admin';
import styles from './tableMap.module.css';

import { MdMap } from "react-icons/md";


const LEGEND = [
  { className: 'free',   label_ua: 'Вільний',  label_en: 'Free' },
  { className: 'busy',   label_ua: 'Зайнятий', label_en: 'Busy' },
  { className: 'bill', label_ua: 'Рахунок',  label_en: 'Bill' },
  { className: 'waiter', label_ua: 'Виклик офіціанта', label_en: 'Waiter call' },
];

// Map API status → UI status key
function mapStatus(apiStatus) {
  if (!apiStatus) return 'free';
  const s = apiStatus.toLowerCase();
  if (s === 'occupied') return 'busy';
  if (s === 'waiter_call') return 'waiter';
  return s; // free, bill
}

// Normalize API table to shape expected by TableMapItem
function normaliseTable(t) {
  return {
    id: t.number ?? t._id,
    status: mapStatus(t.status),
    seats: t.capacity ?? t.seats ?? 4,
    dishes: (t.currentOrder?.items || []).map(i =>
      (typeof i.menuItemId === 'object' ? i.menuItemId?.name : null) || i.name || '—'
    ),
  };
}

export default function TableMap() {
  const { t, i18n } = useTranslation('tableMap');
  const lang = i18n.language === 'en' ? 'en' : 'ua';
  const [tables, setTables] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getTables();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setTables(data.map(normaliseTable));
        }
      } catch (err) {
        console.error('getTables error:', err);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <StaffShell title={<> <MdMap /> {t('title')}</>}>
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
            {tables.map(table => (
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