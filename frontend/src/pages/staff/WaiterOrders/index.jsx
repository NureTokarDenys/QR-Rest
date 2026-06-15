import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import StaffShell from '../../../components/staff/StaffShell';
import WsStatusBanner from '../../../components/WsStatusBanner';
import { Skel } from '../../../components/staff/Skeleton';
import { useStaffData } from '../../../context/StaffDataContext';
import { getOrder, voidOrder, resolveWaiterCall } from '../../../api/orders';
import { useWebSocket } from '../../../hooks/useWebSocket';
import styles from './waiterOrders.module.css';

import { MdTableRestaurant, MdAccessTime, MdPerson, MdPayments, MdCheck } from 'react-icons/md';

const STATUS_ORDER = { waiting: 0, cooking: 1, ready: 2, served: 3 };

/** Pulls live waiter-call flags from a cached table row. */
function mergeLiveTableInfo(table) {
  return {
    waiterCall:     table.activeWaiterCall?.type === 'call',
    waiterCallCash: table.activeWaiterCall?.type === 'cash_payment',
    waiterCallId:   table.activeWaiterCall?._id ?? null,
  };
}

/** Stable sort: calls first (cash before regular), then by cooking status. */
function sortOrders(arr) {
  return [...arr].sort((a, b) => {
    const aAlert = a.waiterCallCash || a.waiterCall;
    const bAlert = b.waiterCallCash || b.waiterCall;
    if (aAlert !== bAlert) return aAlert ? -1 : 1;
    if (a.waiterCallCash !== b.waiterCallCash) return a.waiterCallCash ? -1 : 1;
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  });
}

// Module-scoped per-order detail cache. Persists across navigations so
// re-opening /orders is instantaneous. Entries are evicted only on the WS
// events that change them, never on unmount.
const orderDetailCache = new Map();

/**
 * Build the rendered list synchronously from cached tables + cached details.
 * Returns `complete: true` only when every occupied table has its order
 * detail in the cache — the page uses this flag to decide whether it still
 * needs to show the skeleton (preventing a flash of the empty state).
 */
function deriveOrdersFromCache(tables) {
  if (!Array.isArray(tables))   return { orders: [], complete: false };
  const occupied = tables.filter(t => t.currentOrder);
  if (occupied.length === 0)    return { orders: [], complete: true }; // genuinely no orders
  let complete = true;
  const rows = [];
  for (const table of occupied) {
    const orderId = String(table.currentOrder._id);
    const detail  = orderDetailCache.get(orderId);
    if (!detail) { complete = false; continue; }
    rows.push({ ...detail, ...mergeLiveTableInfo(table) });
  }
  return { orders: sortOrders(rows), complete };
}

function ordinalStatus(items) {
  if (!items?.length) return 'waiting';
  const counts = { waiting: 0, cooking: 0, ready: 0, served: 0 };
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1;
  if (counts.ready   > 0) return 'ready';
  if (counts.cooking > 0) return 'cooking';
  if (counts.waiting > 0) return 'waiting';
  return 'served';
}

function timeAgo(dateStr, t) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1)  return t('time_less1_min');
  if (diff < 60) return t('time_min', { n: diff });
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? t('time_hour_min', { h, m }) : t('time_hour', { h });
}

/**
 * Loading placeholder for a single order card — same structure & classes as the
 * real card so every grey block lands exactly where its real counterpart will.
 * Intentionally monochrome (no status colours) per the loading-screen reference.
 *  - dishes: number of item rows
 *  - more:   render the "+N ще…" line below the list
 */
function OrderCardSkeleton({ dishes = 3, more = false }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.tableLabel}>
          <Skel w={18} h={18} r={5} />
          <Skel w={84} h={15} />
        </span>
        <Skel w={74} h={18} r={20} />
      </div>

      <ul className={styles.itemList}>
        {Array.from({ length: dishes }).map((_, i) => (
          <li key={i} className={styles.itemRow}>
            <span className={styles.itemName}>
              <Skel w={`${52 + ((i * 19) % 34)}%`} h={13} />
            </span>
            <Skel w={20} h={12} />
            <Skel w={8} h={8} r="50%" />
          </li>
        ))}
        {more && (
          <li className={styles.moreItems}>
            <Skel w={60} h={12} />
          </li>
        )}
      </ul>

      <div className={styles.cardBottom}>
        <span className={styles.time}><Skel w={84} h={12} /></span>
        <Skel w={56} h={15} />
      </div>

      <div className={styles.cardActions}>
        <Skel w="100%" h={30} r={8} />
      </div>
    </div>
  );
}

export default function WaiterOrders() {
  const { t } = useTranslation('components');
  const navigate = useNavigate();
  const local = useLocalField();

  // Tables — lazy-loaded the first time /orders is visited, then kept fresh via WS.
  const { tables: cachedTables, refreshTables, ensureTables } = useStaffData();
  useEffect(() => { ensureTables(); }, [ensureTables]);

  // Derive the order list synchronously from whatever is already in the
  // module-level cache on first render. If every occupied table has a cached
  // detail entry (`complete: true`) the page renders with no loading state.
  // Otherwise the skeleton stays — that prevents a single-frame flash of the
  // "no active orders" empty state while details are still being fetched.
  const initial = deriveOrdersFromCache(cachedTables);
  const [orders, setOrders]   = useState(initial.orders);
  const [loading, setLoading] = useState(!initial.complete);
  const [error, setError]     = useState('');

  const [acceptingCallId, setAcceptingCallId] = useState(null);

  const [voidingOrderId, setVoidingOrderId] = useState(null);
  const [voidReason, setVoidReason]         = useState('');
  const [voidSaving, setVoidSaving]         = useState(false);
  const [voidError, setVoidError]           = useState('');

  // Reads from the module cache + cached tables. Fetches per-order detail only
  // for orders not yet cached. WS events evict invalidated entries first.
  const loadOrders = useCallback(async (forceOrderIds = null) => {
    setError('');
    const tables = cachedTables;
    if (!Array.isArray(tables) || tables.length === 0) {
      // Cache hasn't populated yet — wait for the next render.
      return;
    }

    const occupied = tables
      .filter(table => table.currentOrder)
      .map(table => ({ table, orderId: String(table.currentOrder._id) }));

    if (occupied.length === 0) { setOrders([]); setLoading(false); return; }

    // Forced invalidation list (e.g. from WS): drop those entries.
    if (forceOrderIds) {
      forceOrderIds.forEach(id => orderDetailCache.delete(String(id)));
    }

    // Render whatever the module cache already has, but only flip `loading`
    // off when every occupied table has its detail — otherwise the empty
    // state would flash for one frame before the fetch fills in the rest.
    const snap = deriveOrdersFromCache(tables);
    setOrders(snap.orders);
    if (snap.complete) setLoading(false);

    // Fetch only orders we don't have cached.
    const missing = occupied.filter(o => !orderDetailCache.has(o.orderId));
    if (missing.length === 0) { setLoading(false); return; }

    const results = await Promise.allSettled(
      missing.map(async ({ table, orderId }) => {
        const data  = await getOrder(orderId);
        const items = (data?.items || []).map(i => ({
          id:      i._id || i.id,
          name:    (typeof i.menuItemId === 'object' ? i.menuItemId?.name : null) || i.name || '—',
          name_en: (typeof i.menuItemId === 'object' ? i.menuItemId?.name_en : null) || i.name_en || null,
          qty:     i.qty ?? i.quantity ?? 1,
          price:   i.totalPrice ?? i.price ?? 0,
          status:  i.dishStatus || 'waiting',
        }));
        const entry = {
          orderId,
          tableNum:    table.number ?? table._id,
          tableName:   table.name || `Стіл ${table.number}`,
          createdAt:   data?.order?.createdAt || data?.createdAt || null,
          items,
          total:       items.reduce((s, i) => s + i.price, 0),
          status:      ordinalStatus(items),
        };
        orderDetailCache.set(orderId, entry);
        return entry;
      })
    );

    setOrders(deriveOrdersFromCache(tables).orders);
    setLoading(false);

    // Surface any per-order fetch errors (we still show the rest)
    const anyError = results.some(r => r.status === 'rejected');
    if (anyError) setError(t('loadOrdersError'));
  }, [cachedTables, t]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  // Reload the full order list whenever a relevant event arrives on the
  // waiter room (ORDER_NEW, ORDER_UPDATED, WAITER_CALL, TABLE_STATUS_UPDATED).
  // WS events that change orders: invalidate the per-order cache entry and
  // re-derive the list. TABLE_STATUS_UPDATED / WAITER_CALL_* don't touch the
  // detail cache — the cached tables list refresh handles those.
  const handleWsMessage = useCallback((msg) => {
    const ev = msg?.event;
    const orderId = msg?.payload?.orderId;
    const orderTouchingEvents = new Set([
      'ORDER_NEW', 'ORDER_UPDATED', 'ORDER_VOID', 'ORDER_CANCELLED',
      'ORDER_ITEMS_ADDED', 'ORDER_COMPLETED',
      'DISH_STATUS_UPDATED', 'GROUP_STATUS_UPDATED', 'GROUP_CANCELLED',
      'PAYMENT_COMPLETED',
    ]);
    if (orderTouchingEvents.has(ev) && orderId) {
      loadOrders([orderId]);
    }
    // For new orders + cancellations we also need fresh `tables`
    if (['ORDER_NEW', 'ORDER_CANCELLED', 'ORDER_COMPLETED'].includes(ev)) {
      refreshTables();
    }
  }, [loadOrders, refreshTables]);

  const { status: wsStatus } = useWebSocket({ onMessage: handleWsMessage });

  // Re-derive whenever cached tables update (covers initial load + WS-driven
  // table refreshes). No polling — WS + cache invalidation is the source of truth.
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleAcceptCall(e, callId, tableNum) {
    e.stopPropagation();
    if (!callId || acceptingCallId) return;
    setAcceptingCallId(callId);
    try {
      await resolveWaiterCall(callId);
      loadOrders();
      navigate(`/staff/table/${tableNum}`);
    } catch (err) {
      console.error('resolveWaiterCall error:', err);
      setAcceptingCallId(null);
    }
  }

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

  if (loading) {
    const SKELETON_CARDS = [
      { dishes: 2 },
      { dishes: 4 },
      { dishes: 4, more: true },
      { dishes: 3 },
    ];
    return (
      <StaffShell title={t('nav_orders')}>
        <div className={styles.page}>
          <div className={styles.header}>
            <span className={styles.count}><Skel w={110} h={15} /></span>
          </div>

          <div className={styles.grid}>
            {SKELETON_CARDS.map((cfg, i) => (
              <OrderCardSkeleton key={i} {...cfg} />
            ))}
          </div>
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell title={t('nav_orders')}>
      <WsStatusBanner status={wsStatus} />
      <div className={styles.page}>
        <div className={styles.header}>
          <span className={styles.count}>
            {loading ? '…' : orders.length} {t('nav_orders').toLowerCase()}
          </span>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <div className={styles.empty}>
            <MdTableRestaurant className={styles.emptyIcon} />
            <p>{t('noActiveOrders')}</p>
          </div>
        )}

        <div className={styles.grid}>
          {orders.map(order => (
            <div
              key={order.orderId}
              className={`${styles.card} ${order.waiterCallCash ? styles.cardAlertCash : order.waiterCall ? styles.cardAlert : ''}`}
              onClick={() => navigate(`/staff/order/${order.orderId}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/staff/order/${order.orderId}`)}
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
                  <MdPayments className={styles.waiterAlertIcon} />
                  <span className={styles.waiterAlertText}>{t('waiterCalledCash')}</span>
                  <button
                    className={styles.waiterAlertAcceptBtn}
                    onClick={e => handleAcceptCall(e, order.waiterCallId, order.tableNum)}
                    disabled={acceptingCallId === order.waiterCallId}
                  >
                    {acceptingCallId === order.waiterCallId ? '…' : <><MdCheck /> {t('acceptCall')}</>}
                  </button>
                </div>
              )}
              {order.waiterCall && !order.waiterCallCash && (
                <div className={styles.waiterAlert}>
                  <MdPerson className={styles.waiterAlertIcon} />
                  <span className={styles.waiterAlertText}>{t('waiterCalled')}</span>
                  <button
                    className={styles.waiterAlertAcceptBtn}
                    onClick={e => handleAcceptCall(e, order.waiterCallId, order.tableNum)}
                    disabled={acceptingCallId === order.waiterCallId}
                  >
                    {acceptingCallId === order.waiterCallId ? '…' : <><MdCheck /> {t('acceptCall')}</>}
                  </button>
                </div>
              )}

              <ul className={styles.itemList}>
                {order.items.slice(0, 4).map(item => (
                  <li key={item.id} className={styles.itemRow}>
                    <span className={styles.itemName}>{local(item, 'name')}</span>
                    <span className={styles.itemQty}>×{item.qty}</span>
                    <span className={`${styles.itemDot} ${styles[`dot_${item.status}`]}`} />
                  </li>
                ))}
                {order.items.length > 4 && (
                  <li className={styles.moreItems}>{t('moreItems', { n: order.items.length - 4 })}</li>
                )}
              </ul>

              <div className={styles.cardBottom}>
                <span className={styles.time}>
                  <MdAccessTime /> {timeAgo(order.createdAt, t)}
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
