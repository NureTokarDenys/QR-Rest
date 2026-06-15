import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdClose, MdTableRestaurant } from 'react-icons/md';
import { getRestaurantTables } from '../../../api/restaurants';
import { useTranslation } from 'react-i18next';
import styles from './tablePickerSheet.module.css';

/**
 * TablePickerSheet — bottom sheet listing all restaurant tables.
 *
 * Props:
 *   open          — whether the sheet is visible
 *   currentTableId — the guest's current tableId (highlighted, not selectable)
 *   onSelect(table) — called with the selected table object
 *   onClose       — called when the sheet should close
 */
export default function TablePickerSheet({ open, currentTableId, onSelect, onClose }) {
  const { t } = useTranslation('orderStatus');
  const [tables, setTables]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    getRestaurantTables()
      .then(data => setTables(data))
      .catch(() => setError(t('change_table_load_error')))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.handle} />
        <div className={styles.header}>
          <span className={styles.title}>{t('change_table_title')}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <MdClose />
          </button>
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.stateMsg}>…</p>}
          {error   && <p className={styles.errorMsg}>{error}</p>}
          {!loading && !error && (
            <div className={styles.grid}>
              {tables.map(table => {
                const isCurrent  = String(table._id) === String(currentTableId);
                const isOccupied = table.status === 'occupied' && !isCurrent;
                const disabled   = isCurrent || isOccupied;

                let statusLabel = '';
                let statusCls   = '';
                if (isCurrent)  { statusLabel = t('change_table_current');  statusCls = styles.badgeCurrent;  }
                else if (isOccupied) { statusLabel = t('change_table_occupied'); statusCls = styles.badgeOccupied; }
                else            { statusLabel = t('change_table_free');     statusCls = styles.badgeFree;     }

                return (
                  <button
                    key={table._id}
                    className={`${styles.tableCard} ${isCurrent ? styles.cardCurrent : ''} ${isOccupied ? styles.cardOccupied : ''}`}
                    disabled={disabled}
                    onClick={() => !disabled && onSelect(table)}
                  >
                    <MdTableRestaurant className={styles.tableIcon} />
                    <span className={styles.tableNumber}>#{table.number}</span>
                    {table.label || table.name
                      ? <span className={styles.tableName}>{table.label || table.name}</span>
                      : null
                    }
                    <span className={`${styles.statusBadge} ${statusCls}`}>{statusLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
