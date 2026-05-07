import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import { getTables } from '../../../api/admin';
import { getOrder } from '../../../api/orders';
import styles from './waiterOrders.module.css';

import { MdTableRestaurant, MdAccessTime, MdPerson, MdRefresh } from 'react-icons/md';

const STATUS_ORDER = { waiting: 0, cooking: 1, ready: 2, served: 3 };

function ordinalStatus(items) {
  if (!items?.length) return 'waiting';
  const counts = { waiting: 0, cooking: 0, ready: 0, served: 0 };
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
  if (counts.ready   > 0) return 'ready';
  if (counts.cooking > 0) return 'cooking';
  if (counts.waiting > 0) return 'waiting';
  return 'served';
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1)  return '<1 хв';
  if (diff < 60) return `${diff} хв`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h} год ${m} хв` : `${h} год`;
}

export default function WaiterOrders() {
  const { t } = useTranslation('components');
  const navigate = useNavigate();

  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const tables = await getTables();
      if (!Array.isArray(tables)) { setOrders([]); return; }

      // Keep only tables that have an active order
      const occupied = tables.filter(
        t => t.currentOrder?._id || t.currentOrderId
      );

      // Fetch each order's items in parallel
      const results = await Promise.allSettled(
        occupied.map(async table => {
          const orderId = table.currentOrder?._id || table.currentOrderId;
          const data    = await getOrder(orderId);
          const items   = (data?.items || []).map(i => ({
            id:     i._id || i.id,
            name:   (typeof i.menuItemId === 'object' ? i.menuItemId?.name : null) || i.name || '—',
            qty:    i.qty ?? i.quantity ?? 1,
            price:  i.totalPrice ?? i.price ?? 0,
            status: i.dishStatus || 'waiting',
          }));
          const total = items.reduce((s, i) => s + i.price, 0);
          return {
            orderId,
            tableNum:    table.number ?? table._id,
            tableName:   table.name || `Стіл ${table.number}`,
            waiterCall:  table.status === 'waiter_call',
            createdAt:   data?.order?.createdAt || data?.createdAt || null,
            items,
            total,
            status:      ordinalStatus(items),
          };
        })
      );

      const loaded = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .sort((a, b) => {
          // waiter calls first, then by order status (ready first), then by time
          if (a.waiterCall !== b.waiterCall) return a.waiterCall ? -1 : 1;
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        });

      setOrders(loaded);
    } catch (err) {
      console.error('WaiterOrders load error:', err);
      setError('Не вдалося завантажити замовлення');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  function statusLabel(s) {
    if (s === 'ready')   return t('status_ready');
    if (s === 'cooking') return t('status_cooking');
    if (s === 'served')  return t('status_served');
    return t('status_waiting');
  }

  return (
    <StaffShell title={t('nav_orders')}>
      <div className={styles.page}>
        <div className={styles.header}>
          <span className={styles.count}>
            {loading ? '…' : orders.length} {t('nav_orders').toLowerCase()}
          </span>
          <button className={styles.refreshBtn} onClick={loadOrders} disabled={loading}>
            <MdRefresh className={loading ? styles.spinning : ''} />
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <div className={styles.empty}>
            <MdTableRestaurant className={styles.emptyIcon} />
            <p>Активних замовлень немає</p>
          </div>
        )}

        <div className={styles.grid}>
          {orders.map(order => (
            <button
              key={order.orderId}
              className={`${styles.card} ${order.waiterCall ? styles.cardAlert : ''}`}
              onClick={() => navigate(`/staff/table/${order.tableNum}`)}
            >
              <div className={styles.cardTop}>
                <span className={styles.tableLabel}>
                  <MdTableRestaurant />
                  {order.tableName}
                </span>
                <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                  {statusLabel(order.status)}
                </span>
              </div>

              {order.waiterCall && (
                <div className={styles.waiterAlert}>
                  <MdPerson /> {t('waiterCalled')}
                </div>
              )}

              <ul className={styles.itemList}>
                {order.items.slice(0, 4).map(item => (
                  <li key={item.id} className={styles.itemRow}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemQty}>×{item.qty}</span>
                    <span className={`${styles.itemDot} ${styles[`dot_${item.status}`]}`} />
                  </li>
                ))}
                {order.items.length > 4 && (
                  <li className={styles.moreItems}>+{order.items.length - 4} ще…</li>
                )}
              </ul>

              <div className={styles.cardBottom}>
                <span className={styles.time}>
                  <MdAccessTime /> {timeAgo(order.createdAt)}
                </span>
                <span className={styles.total}>{order.total} ₴</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </StaffShell>
  );
}
