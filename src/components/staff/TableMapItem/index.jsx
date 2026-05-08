import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TableDishList from '../TableDishList';
import styles from './tableMapItem.module.css';

import { MdTableRestaurant } from 'react-icons/md';

const STATUS_COLORS = {
  free:   styles.free,
  busy:   styles.busy,
  bill:   styles.bill,
  waiter: styles.waiter,
};

const BORDER_COLORS = {
  free:   '#4ade80',
  busy:   '#f87171',
  bill:   '#a39e90',
  waiter: '#fbbf24',
};

export default function TableMapItem({ table }) {
  const navigate = useNavigate();
  const { t } = useTranslation('tableMap');
  const [expanded, setExpanded] = useState(false);

  const colorClass  = STATUS_COLORS[table.status] || styles.free;
  const borderColor = BORDER_COLORS[table.status]  || BORDER_COLORS.free;

  const ordersWithDishes = (table.orders || []).filter(o => o.dishes?.length > 0);
  const visibleOrders    = expanded ? ordersWithDishes : ordersWithDishes.slice(0, 1);
  const extraCount       = ordersWithDishes.length - 1;

  return (
    <div
      className={styles.card}
      style={{ borderColor }}
      onClick={() => navigate(`/staff/table/${table.id}`)}
    >
      <div className={styles.header}>
        <span className={styles.tableName}>{table.name}</span>
        <span className={styles.seats}>{table.seats} {t('seat', { count: table.seats })}</span>
      </div>

      <div className={styles.iconWrap}>
        <MdTableRestaurant className={`${styles.icon} ${colorClass}`} />
        <span className={styles.tableNum}>№{table.id}</span>
      </div>

      {visibleOrders.map((order, idx) => (
        <TableDishList key={order.id || idx} dishes={order.dishes} />
      ))}

      {!expanded && extraCount > 0 && (
        <button
          className={styles.showMore}
          onClick={e => { e.stopPropagation(); setExpanded(true); }}
        >
          + {t('moreOrders', { count: extraCount })}
        </button>
      )}
    </div>
  );
}
