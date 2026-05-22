import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TableDishList from '../TableDishList';
import { Skel } from '../Skeleton';
import styles from './tableMapItem.module.css';

import { MdTableRestaurant, MdNotificationsActive, MdPayments } from 'react-icons/md';

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

  const colorClass  = STATUS_COLORS[table.status] || styles.free;
  const borderColor = BORDER_COLORS[table.status]  || BORDER_COLORS.free;

  const order = table.orders?.[0] ?? null;

  const hasCall = table.waiterCall || table.waiterCallCash;

  return (
    <div
      className={`${styles.card} ${hasCall ? styles.callPulse : ''}`}
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

      {table.waiterCallCash && (
        <div className={`${styles.callBadge} ${styles.callBadgeCash}`}>
          <MdPayments /> {t('bill_requested')}
        </div>
      )}
      {table.waiterCall && !table.waiterCallCash && (
        <div className={styles.callBadge}>
          <MdNotificationsActive /> {t('waiterCalled')}
        </div>
      )}

      {order && order.dishes?.length > 0 && (
        <TableDishList dishes={order.dishes} />
      )}
    </div>
  );
}

/**
 * Loading placeholder — same structure & classes as the real card so every
 * grey block sits exactly where its real counterpart will appear.
 *  - withDishes: render the "Страви" dish-list box (mimics an occupied table)
 *  - withBadge:  render the call-badge bar (виклик офіціанта / рахунок)
 */
export function TableMapItemSkeleton({ withDishes = true, withBadge = false, dishRows = 3 }) {
  return (
    <div className={styles.card} style={{ borderColor: 'var(--separator-color)' }}>
      <div className={styles.header}>
        <Skel w={92} h={16} />
        <Skel w={52} h={12} />
      </div>

      <div className={styles.iconWrap}>
        <Skel w={72} h={72} r={14} />
        <Skel w={50} h={22} style={{ marginTop: 2 }} />
      </div>

      {withBadge && <Skel w="100%" h={24} r={6} />}

      {withDishes && (
        <div className={styles.skelDishBox}>
          <Skel w={44} h={9} style={{ marginBottom: 4 }} />
          {Array.from({ length: dishRows }).map((_, i) => (
            <div key={i} className={styles.skelDishRow}>
              <Skel w={`${48 + ((i * 17) % 28)}%`} h={11} />
              <Skel w={56} h={16} r={6} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
