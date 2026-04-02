import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TableDishList from '../TableDishList';
import styles from './tableMapItem.module.css';

const STATUS_COLORS = {
  free:   styles.free,
  busy:   styles.busy,
  waiter: styles.waiter,
};

export default function TableMapItem({ table }) {
  const navigate = useNavigate();
  const { t } = useTranslation('tableMap');

  const colorClass = STATUS_COLORS[table.status] || styles.free;

  return (
    <div className={styles.wrapper} onClick={() => navigate(`/staff/table/${table.id}`)}>
      <div className={`${styles.icon} ${colorClass}`}>
        <span className={styles.tableNum}>{table.id}</span>
        <span className={styles.seats}>{table.seats} {t('seats')}</span>
      </div>
      {table.dishes && table.dishes.length > 0 && (
        <TableDishList dishes={table.dishes} />
      )}
    </div>
  );
}