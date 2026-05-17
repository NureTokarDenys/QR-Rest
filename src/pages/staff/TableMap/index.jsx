import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import TableMapItem from '../../../components/staff/TableMapItem';
import { getTables } from '../../../api/admin';
import styles from './tableMap.module.css';

import { MdMap } from "react-icons/md";


const LEGEND = [
  { className: 'free',     label_ua: 'Вільний',  label_en: 'Free' },
  { className: 'busy',     label_ua: 'Зайнятий', label_en: 'Busy' },
  { className: 'disabled', label_ua: 'Вимкнений', label_en: 'Disabled' },
];

// Map API status → UI status key
function mapStatus(apiStatus) {
  if (!apiStatus) return 'free';
  const s = apiStatus.toLowerCase();
  if (s === 'occupied') return 'busy';
  return s; // free, disabled
}

function mapDishes(items = []) {
  return items.map(i => {
    const mi = typeof i.menuItemId === 'object' ? i.menuItemId : null;
    return {
      name:    mi?.name    || i.name    || '—',
      name_en: mi?.name_en || mi?.name  || i.name || '—',
      status:  i.dishStatus,
    };
  });
}

// Normalize API table to shape expected by TableMapItem
function normaliseTable(t) {
  const raw = t.currentOrder ?? null;
  return {
    id:     t.number ?? t._id,
    name:   t.name || t.label || `Стіл ${t.number}`,
    status: mapStatus(t.status),
    seats:  t.capacity ?? t.seats ?? 4,
    orders: raw ? [{ id: raw._id, dishes: mapDishes(raw.items) }] : [],
  };
}

export default function TableMap() {
  const { t, i18n } = useTranslation('tableMap');
  const lang = i18n.language;
  const [tables, setTables] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getTables();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setTables(data.map(normaliseTable).sort((a, b) => a.id - b.id));
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
        </div>
      </div>
    </StaffShell>
  );
}