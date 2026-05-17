import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import WsStatusBanner from '../../../components/WsStatusBanner';
import { getTables } from '../../../api/admin';
import { getOrder, voidOrder } from '../../../api/orders';
import { useWebSocket } from '../../../hooks/useWebSocket';
import styles from './waiterOrders.module.css';

import { MdTableRestaurant, MdAccessTime, MdPerson, MdPayments, MdRefresh } from 'react-icons/md';

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

  const [voidingOrderId, setVoidingOrderId] = useState(null);
  const [voidReason, setVoidReason]         = useState('');
  const [voidSaving, setVoidSaving]         = useState(false);
  const [voidError, setVoidError]           = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const tables = await getTables();
      if (!Array.isArray(tables)) { setOrders([]); return; }

      // One active order per table
      const occupied = tables
        .filter(table => table.currentOrder)
        .map(table => ({ table, orderId: table.currentOrder._id }));

      // Fetch each order's items in parallel
      const results = await Promise.allSettled(
        occupied.map(async ({ table, orderId }) => {
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
            waiterCall:     false,
            waiterCallCash: false,
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
          const aAlert = a.waiterCallCash || a.waiterCall;
          const bAlert = b.waiterCallCash || b.waiterCall;
          if (aAlert !== bAlert) return aAlert ? -1 : 1;
          // cash payment requests before general calls
          if (a.waiterCallCash !== b.waiterCallCash) return a.waiterCallCash ? -1 : 1;
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

  // ── WebSocket ──────────────────────────────────────────────────────────────
  // Reload the full order list whenever a relevant event arrives on the
  // waiter room (ORDER_NEW, ORDER_UPDATED, WAITER_CALL, TABLE_STATUS_UPDATED).
  const handleWsMessage = useCallback((msg) => {
    const relevant = new Set([
      'ORDER_NEW', 'ORDER_UPDATED', 'ORDER_VOID', 'ORDER_CANCELLED',
      'WAITER_CALL', 'WAITER_CALL_CASH', 'WAITER_CALL_CONFIRMED',
      'TABLE_STATUS_UPDATED', 'PAYMENT_COMPLETED',
    ]);
    if (relevant.has(msg.event)) loadOrders();
  }, [loadOrders]);

  const { status: wsStatus } = useWebSocket({ onMessage: handleWsMessage });

  useEffect(() => {
    loadOrders();
    // Fallback poll — catches anything missed during a WS gap
    const interval = setInterval(loadOrders, 60_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  function openVoid(orderId) {
    setVoidingOrderId(orderId);
    setVoidReason('');
    setVoidError('');
  }

  function cancelVoid() {
    setVoidingOrderId(null);
    setVoidReason('');
    setVoidError('');
  }

  async function handleVoidOrder(orderId) {
    if (voidReason.trim().length < 10) {
      setVoidError(t('voidReasonTooShort'));
      return;
    }
    setVoidSaving(true);
    setVoidError('');
    try {
      await voidOrder(orderId, voidReason.trim());
      cancelVoid();
      loadOrders();
    } catch (err) {
      console.error('voidOrder error:', err);
      setVoidError(err?.response?.data?.message || t('voidReasonTooShort'));
    } finally {
      setVoidSaving(false);
    }
  }

  function statusLabel(s) {
    if (s === 'ready')   return t('status_ready');
    if (s === 'cooking') return t('status_cooking');
    if (s === 'served')  return t('status_served');
    return t('status_waiting');
  }

  return (
    <StaffShell title={t('nav_orders')}>
      <WsStatusBanner status={wsStatus} />
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
            <div
              key={order.orderId}
              className={`${styles.card} ${order.waiterCallCash ? styles.cardAlertCash : order.waiterCall ? styles.cardAlert : ''}`}
              onClick={() => navigate(`/staff/table/${order.tableNum}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/staff/table/${order.tableNum}`)}
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

              {order.waiterCallCash && (
                <div className={`${styles.waiterAlert} ${styles.waiterAlertCash}`}>
                  <MdPayments /> {t('waiterCalledCash')}
                </div>
              )}
              {order.waiterCall && !order.waiterCallCash && (
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

              {/* ── Actions ── */}
              <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                <button
                  className={`${styles.cardActionBtn} ${styles.cardVoidBtn}`}
                  onClick={() => voidingOrderId === order.orderId ? cancelVoid() : openVoid(order.orderId)}
                >
                  {t('voidOrder')}
                </button>
              </div>

              {voidingOrderId === order.orderId && (
                <div className={styles.voidForm} onClick={e => e.stopPropagation()}>
                  <textarea
                    className={styles.voidReasonInput}
                    value={voidReason}
                    onChange={e => { setVoidReason(e.target.value); setVoidError(''); }}
                    placeholder={t('voidReasonPlaceholder')}
                    rows={2}
                    autoFocus
                  />
                  {voidError && <span className={styles.voidErrorText}>{voidError}</span>}
                  <div className={styles.voidFormActions}>
                    <button
                      className={styles.voidConfirmBtn}
                      onClick={() => handleVoidOrder(order.orderId)}
                      disabled={voidSaving}
                    >
                      {voidSaving ? '…' : t('confirmVoid')}
                    </button>
                    <button className={styles.voidCancelBtn} onClick={cancelVoid}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </StaffShell>
  );
}
