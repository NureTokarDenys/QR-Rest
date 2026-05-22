import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import TableQrBlock from '../../../components/staff/TableQrBlock';
import TableHistoryBlock from '../../../components/staff/TableHistoryBlock';
import WsStatusBanner from '../../../components/WsStatusBanner';
import { Skel } from '../../../components/staff/Skeleton';
import { fieldFor } from '../../../i18n/langs';
import { useAuth } from '../../../context/AuthContext';
import { updateTable } from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import {
  getOrder, getTableOrders,
  addOrderItems, updateOrderItem, deleteOrderItem,
  voidOrder,
  getWaiterCalls, resolveWaiterCall,
  openTableRecovery,
} from '../../../api/orders';
import { updateGroupStatus } from '../../../api/kitchen';
import { useWebSocket } from '../../../hooks/useWebSocket';
import styles from './tableDetail.module.css';

import { MdEdit, MdDelete, MdAdd, MdCheck, MdClose, MdSearch, MdBlock, MdAccountCircle } from 'react-icons/md';

function mapStatus(s) {
  if (!s) return 'free';
  if (s === 'occupied') return 'busy';
  return s; // free, disabled
}

function getGroupStatus(items) {
  if (!items.length) return 'waiting';
  const ss = items.map(i => i.status || 'waiting');
  if (ss.every(s => s === 'served')) return 'served';
  if (ss.every(s => s === 'ready' || s === 'served')) return 'ready';
  if (ss.some(s => s === 'cooking' || s === 'ready')) return 'cooking';
  return 'waiting';
}

// Accepts t() so the output respects the current UI language
function timeAgo(dateStr, t) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1)  return t('timeAgoLess1', '<1 хв');
  if (diff < 60) return `${diff} ${t('timeAgoMin', 'хв')}`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0
    ? `${h} ${t('timeAgoHour', 'год')} ${m} ${t('timeAgoMin', 'хв')}`
    : `${h} ${t('timeAgoHour', 'год')}`;
}

export default function TableDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation('tableDetail');
  const { user } = useAuth();
  const isAdmin = ['admin', 'root_admin'].includes(user?.role);
  // Shared cache: tables + menu items are lazy-loaded the first time this page
  // (or any other page that needs them) is opened, then kept fresh via WS.
  const { tables: cachedTables, menuItems: cachedMenu, refreshTables, ensureTables, ensureMenuItems } = useStaffData();
  useEffect(() => { ensureTables(); ensureMenuItems(); }, [ensureTables, ensureMenuItems]);

  const [tableInfo, setTableInfo] = useState({
    id, status: 'free', seats: 4, name: `Стіл ${id}`,
  });
  const [orders, setOrders]         = useState([]);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pendingCall, setPendingCall]     = useState(null);
  const [acceptingCall, setAcceptingCall] = useState(false);
  const [resolvedCall, setResolvedCall]   = useState(null); // { resolvedAt: Date }
  const [callNow, setCallNow]             = useState(() => Date.now());

  // inline edit state
  const [editItem, setEditItem] = useState(null);

  // void order state
  const [voidingOrderId, setVoidingOrderId] = useState(null);
  const [voidReason, setVoidReason]         = useState('');
  const [voidSaving, setVoidSaving]         = useState(false);
  const [voidError, setVoidError]           = useState('');

  // recovery-window state
  const [recoveryWindowUntil, setRecoveryWindowUntil] = useState(null); // Date | null
  const [recoveryOpening, setRecoveryOpening]         = useState(false);
  const [countdown, setCountdown]                     = useState(null); // seconds remaining | null

  // add-items panel state
  const [addOrderId, setAddOrderId]   = useState(null);
  const [allMenuItems, setAllMenuItems] = useState([]);
  const [search, setSearch]           = useState('');
  const [addQtys, setAddQtys]         = useState({});
  const [addSaving, setAddSaving]     = useState(false);

  // table info inline edit state (admin-only)
  const [tableEditing, setTableEditing]   = useState(false);
  const [tableEditForm, setTableEditForm] = useState({ number: '', label: '' });
  const [tableEditError, setTableEditError] = useState('');
  const [tableEditSaving, setTableEditSaving] = useState(false);
  const [tableEditSuccess, setTableEditSuccess] = useState(false);
  // cached full tables list — used for client-side duplicate check
  const allTablesRef = useRef([]);

  // ── Recovery-window countdown ─────────────────────────────────────────────────
  useEffect(() => {
    if (!recoveryWindowUntil) { setCountdown(null); return; }
    function tick() {
      const remaining = Math.max(0, Math.ceil((recoveryWindowUntil.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) setRecoveryWindowUntil(null);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [recoveryWindowUntil]);

  // Live elapsed timer for the pending call — ticks every second when a call is active
  useEffect(() => {
    if (!pendingCall) return;
    const id = setInterval(() => setCallNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pendingCall?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatElapsed(ms) {
    if (ms < 0) return '0s';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  }

  function formatCountdown(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function openRecoveryWindow() {
    if (!tableInfo._id) return;
    setRecoveryOpening(true);
    try {
      const data = await openTableRecovery(tableInfo._id);
      if (data?.recoveryWindowClosesAt) {
        setRecoveryWindowUntil(new Date(data.recoveryWindowClosesAt));
      }
    } catch (err) {
      console.error('openRecoveryWindow error:', err);
    } finally {
      setRecoveryOpening(false);
    }
  }

  // ── Table info edit ──────────────────────────────────────────────────────────
  function openTableEdit() {
    setTableEditForm({ number: String(tableInfo.id ?? ''), label: tableInfo.label ?? '' });
    setTableEditError('');
    setTableEditSuccess(false);
    setTableEditing(true);
  }

  function cancelTableEdit() {
    setTableEditing(false);
    setTableEditError('');
  }

  async function saveTableEdit() {
    const num = parseInt(tableEditForm.number, 10);
    if (!tableEditForm.number || isNaN(num) || num < 1) {
      setTableEditError(t('number_required', 'Table number is required'));
      return;
    }
    // Client-side duplicate check
    const others = allTablesRef.current.filter(tbl => String(tbl._id) !== String(tableInfo._id));
    if (others.some(tbl => tbl.number === num)) {
      setTableEditError(t('duplicateTableNumber'));
      return;
    }
    setTableEditSaving(true);
    setTableEditError('');
    try {
      await updateTable(tableInfo._id, {
        number: num,
        label:  tableEditForm.label.trim() || undefined,
      });
      setTableEditing(false);
      setTableEditSuccess(true);
      setTimeout(() => setTableEditSuccess(false), 3000);
      // Refresh the shared cache so TableMap (and any other page) sees the change
      await refreshTables();
      await load();
    } catch (err) {
      const code = err?.response?.data?.error?.code || err?.response?.data?.error?.message;
      if (code === 'TABLE_NUMBER_EXISTS') {
        setTableEditError(t('duplicateTableNumber'));
      } else {
        setTableEditError(err?.response?.data?.error?.message || t('save_error', 'Failed to save'));
      }
    } finally {
      setTableEditSaving(false);
    }
  }

  // ── Dish status label map (uses t so it reacts to language changes) ──────────
  const dishStatusLabel = {
    waiting: t('dishWaiting'),
    cooking: t('dishCooking'),
    ready:   t('dishReady'),
    served:  t('dishServed'),
  };

  // ── Table status label map ────────────────────────────────────────────────────
  function tableStatusLabel(status) {
    switch (status) {
      case 'free':     return t('statusFree');
      case 'busy':     return t('statusBusy');
      case 'waiter':   return t('statusWaiter');
      case 'reserved': return t('statusReserved');
      default:         return status;
    }
  }

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      // Use cached tables instead of refetching on every navigation.
      // While the cache is still warming up on first paint, fall back to
      // an empty list — load() will be re-invoked once data arrives.
      const allTables = cachedTables || [];
      if (!Array.isArray(allTables) || allTables.length === 0) return;
      allTablesRef.current = allTables;

      const apiTable = allTables.find(
        t => String(t.number) === String(id) || String(t._id) === String(id)
      );
      if (!apiTable) return;

      const tableId = apiTable._id;
      const mappedStatus = mapStatus(apiTable.status);

      setTableInfo({
        id:        apiTable.number ?? tableId,
        status:    mappedStatus,
        seats:     apiTable.capacity ?? 4,
        name:      apiTable.name || apiTable.label || `Стіл ${apiTable.number}`,
        label:     apiTable.label ?? '',
        _id:       tableId,
        shortCode: apiTable.shortCode || null,
      });

      const ref = apiTable.currentOrder ?? null;

      const [loaded, hist, allCalls] = await Promise.all([
        ref
          ? getOrder(ref._id).then(data => {
              const items = (data?.items || []).map(i => ({
                id:             i._id,
                name:           i.menuItemId?.name || i.menuItemName || '—',
                name_en:        i.menuItemId?.name_en || i.menuItemName_en || null,
                qty:            i.qty ?? i.quantity ?? 1,
                price:          i.totalPrice ?? 0,
                status:         i.dishStatus || 'waiting',
                comment:        i.comment || '',
                servingGroupId: i.servingGroupId || null,
              }));
              const servingGroups = (data?.servingGroups || data?.order?.servingGroups || [])
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map(g => ({
                  ...g,
                  status: getGroupStatus(
                    items.filter(i => String(i.servingGroupId) === String(g._id))
                  ),
                }));
              return [{ orderId: ref._id, order: data?.order, items, servingGroups }];
            })
          : Promise.resolve([]),
        getTableOrders(tableId),
        getWaiterCalls({ status: 'active' }),
      ]);

      setOrders(loaded);
      setHistory(hist);

      // Find a pending call for this specific table
      const pending = (allCalls || []).find(
        c => String(c.tableId) === String(tableId)
      );
      setPendingCall(pending || null);
    } catch (err) {
      console.error('TableDetail load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, cachedTables]);

  useEffect(() => { load(); }, [load]);

  // Keep a ref to tableInfo so the WS handler can filter by table without
  // being recreated every time tableInfo changes.
  const tableInfoRef = useRef(tableInfo);
  useEffect(() => { tableInfoRef.current = tableInfo; }, [tableInfo]);

  const RELOAD_EVENTS = new Set([
    'ORDER_NEW', 'ORDER_UPDATED', 'ORDER_VOID', 'ORDER_CANCELLED',
    'DISH_STATUS_UPDATED', 'GROUP_STATUS_UPDATED', 'ORDER_ITEMS_ADDED',
    'WAITER_CALL', 'WAITER_CALL_CASH', 'WAITER_CALL_RESOLVED',
  ]);

  const handleWsMessage = useCallback((msg) => {
    if (!RELOAD_EVENTS.has(msg.event)) return;
    const p = msg.payload;
    // Filter by table when the payload carries an identifier so we don't
    // reload for events belonging to a completely different table.
    if (p) {
      const ti = tableInfoRef.current;
      const matchesById     = ti._id   && String(p.tableId)     === String(ti._id);
      const matchesByNumber = String(p.tableNumber) === String(ti.id);
      // If the payload has no table identifier at all, reload to be safe.
      const hasIdentifier   = p.tableId != null || p.tableNumber != null;
      if (hasIdentifier && !matchesById && !matchesByNumber) return;
    }
    load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const { status: wsStatus } = useWebSocket({ onMessage: handleWsMessage });

  // ── Accept waiter call ───────────────────────────────────────────────────────
  async function handleAcceptCall() {
    if (!pendingCall) return;
    setAcceptingCall(true);
    try {
      await resolveWaiterCall(pendingCall._id);
      setResolvedCall({ resolvedAt: new Date() });
      setPendingCall(null);
      load();
    } catch (err) {
      console.error('resolveWaiterCall error:', err);
    } finally {
      setAcceptingCall(false);
    }
  }

  // ── Edit item ────────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editItem) return;
    try {
      await updateOrderItem(editItem.orderId, editItem.itemId, {
        qty:     editItem.qty,
        comment: editItem.comment,
      });
      setEditItem(null);
      load();
    } catch (err) {
      console.error('updateOrderItem error:', err);
    }
  }

  // ── Void order ───────────────────────────────────────────────────────────────
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

  async function handleVoidOrder() {
    if (voidReason.trim().length < 10) {
      setVoidError(t('voidReasonTooShort'));
      return;
    }
    setVoidSaving(true);
    setVoidError('');
    try {
      await voidOrder(voidingOrderId, voidReason.trim());
      cancelVoid();
      load();
    } catch (err) {
      console.error('voidOrder error:', err);
      setVoidError(err?.response?.data?.message || t('voidReasonTooShort'));
    } finally {
      setVoidSaving(false);
    }
  }

  // ── Delete item ──────────────────────────────────────────────────────────────
  async function handleDelete(orderId, itemId) {
    if (!window.confirm(t('deleteItemConfirm'))) return;
    try {
      await deleteOrderItem(orderId, itemId);
      load();
    } catch (err) {
      console.error('deleteOrderItem error:', err);
    }
  }

  // ── Mark serving group as served ─────────────────────────────────────────────
  async function markGroupServed(orderId, groupId) {
    try {
      await updateGroupStatus(orderId, groupId, 'served');
      load();
    } catch (err) {
      console.error('updateGroupStatus error:', err);
    }
  }

  // ── Add-items panel ──────────────────────────────────────────────────────────
  async function openAddPanel(orderId) {
    setAddOrderId(orderId);
    setAddQtys({});
    setSearch('');
    // Use the shared cache instead of fetching the entire menu again
    if (!allMenuItems.length && Array.isArray(cachedMenu)) {
      setAllMenuItems(cachedMenu.filter(m => m.isAvailable && !m.isDeleted));
    }
  }

  async function submitAdd() {
    const items = Object.entries(addQtys)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => ({ menuItemId, qty }));
    if (!items.length) return;
    setAddSaving(true);
    try {
      await addOrderItems(addOrderId, items);
      setAddOrderId(null);
      load();
    } catch (err) {
      console.error('addOrderItems error:', err);
    } finally {
      setAddSaving(false);
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const grandTotal   = orders[0]?.items.reduce((s, i) => s + (i.price || 0), 0) ?? 0;
  const filteredMenu = allMenuItems.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  const isWaiterCall = tableInfo.status === 'waiter';

  // Recovery only makes sense when the table is actually occupied by a guest
  // session (i.e. there is an active order at the table).
  const hasActiveOrder = orders.length > 0;

  // If the current order was placed by a user who has an account (userId is
  // populated with an email), recovery is unsafe — show their email instead.
  // Only truly anonymous orders (userId null / unpopulated ObjectId) get the
  // recovery button.
  const orderUser   = orders[0]?.order?.userId;
  const isAuthOrder = !!(orderUser?.email);

  // ── Skeleton loader (first load) ─────────────────────────────────────────────
  // Mirrors the real layout 1:1 — every placeholder sits exactly where its real
  // counterpart will appear once data resolves.
  if (loading) {
    return (
      <StaffShell title={`${t('title')} ${tableInfo.id}`} backTo="/staff/map">
        <div className={styles.page}>

          {/* ── Header (.top / .titleBlock / .scanWindowRow) ── */}
          <div className={styles.top}>
            <div className={styles.titleBlock}>
              <div className={styles.tableTitleRow}>
                <Skel w={190} h={26} />
              </div>
              <Skel w={150} h={15} style={{ marginTop: 6 }} />
            </div>
            <div className={styles.scanWindowRow}>
              <Skel w={150} h={38} r={10} />
            </div>
          </div>

          {/* ── Stats (.statsRow → 3× MicroStat .block) ── */}
          <div className={styles.statsRow}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skelStatBlock}>
                <Skel w={70} h={12} />
                <Skel w={90} h={20} />
              </div>
            ))}
          </div>

          {/* ── Order box (.orderBox / .orderHeader / .table) ── */}
          <div className={styles.orderBox}>
            <div className={styles.orderHeader}>
              <Skel w={150} h={16} />
              <div className={styles.sepActions}>
                <Skel w={90} h={28} r={8} />
                <Skel w={120} h={28} r={8} />
              </div>
            </div>

            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th><Skel w={50} h={11} /></th>
                  <th style={{ width: 60 }}><Skel w={28} h={11} /></th>
                  <th style={{ width: 80 }}><Skel w={32} h={11} /></th>
                  <th><Skel w={54} h={11} /></th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className={styles.tableRow}>
                    <td className={styles.td}><Skel w="72%" h={14} /></td>
                    <td className={styles.td}><Skel w={22} h={14} /></td>
                    <td className={styles.td}><Skel w={42} h={14} /></td>
                    <td className={styles.td}><Skel w={70} h={22} r={6} /></td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Skel w={28} h={28} r={6} />
                        <Skel w={28} h={28} r={6} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className={styles.table}>
              <tbody>
                <tr className={styles.subTotalRow}>
                  <td colSpan={2} className={styles.subTotalLabel}><Skel w={60} h={13} /></td>
                  <td colSpan={3} className={styles.subTotalVal}>
                    <Skel w={64} h={14} style={{ marginLeft: 'auto' }} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Bottom row (.bottomRow → QR block + history block) ── */}
          <div className={styles.bottomRow}>
            <div className={styles.skelSideBox}>
              <Skel w={120} h={14} />
              <Skel w={150} h={150} r={8} style={{ alignSelf: 'center' }} />
              <Skel w={90} h={12} style={{ alignSelf: 'center' }} />
              <Skel w="100%" h={38} r={10} />
              <Skel w="100%" h={38} r={10} />
            </div>
            <div className={styles.skelSideBox}>
              <Skel w={140} h={14} style={{ marginBottom: 4 }} />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.skelHistoryRow}>
                  <Skel w={70} h={14} />
                  <Skel w={80} h={20} r={6} />
                  <Skel w={50} h={14} style={{ marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell
      title={`${t('title')} ${tableInfo.id}${isWaiterCall ? ` — ${t('waiterCall')}` : ''}`}
      backTo="/staff/map"
    >
      <WsStatusBanner status={wsStatus} />
      <div className={styles.page}>

        {/* ── Header ── */}
        <div className={styles.top}>
          <div className={styles.titleBlock}>
            {tableEditing ? (
              <div className={styles.tableEditForm}>
                <div className={styles.tableEditFields}>
                  <div className={styles.tableEditField}>
                    <label className={styles.tableEditLabel}>{t('editTableNumber')}</label>
                    <input
                      type="number"
                      min={1}
                      className={styles.tableEditInput}
                      value={tableEditForm.number}
                      onChange={e => { setTableEditForm(f => ({ ...f, number: e.target.value })); setTableEditError(''); }}
                      autoFocus
                    />
                  </div>
                  <div className={styles.tableEditField}>
                    <label className={styles.tableEditLabel}>{t('editTableLabel')}</label>
                    <input
                      type="text"
                      className={styles.tableEditInput}
                      value={tableEditForm.label}
                      onChange={e => setTableEditForm(f => ({ ...f, label: e.target.value }))}
                      placeholder={t('editTableLabel')}
                    />
                  </div>
                </div>
                {tableEditError && <span className={styles.tableEditError}>{tableEditError}</span>}
                <div className={styles.tableEditActions}>
                  <button className={styles.tableEditSaveBtn} onClick={saveTableEdit} disabled={tableEditSaving}>
                    {tableEditSaving ? '…' : t('saveTableInfo')}
                  </button>
                  <button className={styles.tableEditCancelBtn} onClick={cancelTableEdit} disabled={tableEditSaving}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.tableTitleRow}>
                  <h2 className={styles.tableTitle}>{tableInfo.name}</h2>
                  {isAdmin && (
                    <button className={styles.tableEditBtn} onClick={openTableEdit} title={t('editTableInfo')}>
                      <MdEdit />
                    </button>
                  )}
                  {tableEditSuccess && (
                    <span className={styles.tableEditSuccessBadge}><MdCheck /> {t('tableInfoSaved')}</span>
                  )}
                </div>
                <p className={styles.tableSub}>{t('hall')} A · {tableInfo.seats} {t('seats')}</p>
              </>
            )}
          </div>

          <div className={styles.scanWindowRow}>
            {isAuthOrder ? (
              <div className={styles.authOrderInfo}>
                <div className={styles.authOrderAvatar}>
                  <MdAccountCircle />
                </div>
                <div className={styles.authOrderDetails}>
                  {orderUser.name && (
                    <span className={styles.authOrderName}>{orderUser.name}</span>
                  )}
                  <span className={styles.authOrderEmail}>{orderUser.email}</span>
                </div>
              </div>
            ) : hasActiveOrder ? (
              countdown !== null ? (
                <>
                  <span className={styles.scanWindowBanner}>🔄 {t('recoveryWindowOpen') || 'Відновлення відкрито'}</span>
                  <button className={`${styles.scanWindowBtn} ${styles.scanWindowBtnActive}`} disabled>
                    {formatCountdown(countdown)}
                  </button>
                </>
              ) : (
                <button
                  className={styles.scanWindowBtn}
                  onClick={openRecoveryWindow}
                  disabled={recoveryOpening}
                  title={t('recoveryWindowHint') || 'Відкрити 1-хвилинне вікно для відновлення сесії гостя'}
                >
                  🔄 {recoveryOpening ? '…' : (t('openRecoveryWindow') || 'Відновити сесію')}
                </button>
              )
            ) : null}
          </div>
        </div>

        {/* ── Waiter call banner ── */}
        {(pendingCall || isWaiterCall || resolvedCall) && (
          <div className={`${styles.waiterCallBanner} ${resolvedCall ? styles.waiterCallBannerResolved : ''}`}>
            <div className={styles.waiterCallInfo}>
              <span className={styles.waiterCallText}>
                {resolvedCall ? `✅ ${t('callAnswered')}` : `🔔 ${t('waiterCall')}`}
              </span>
              {pendingCall?.createdAt && (
                <span className={styles.waiterCallMeta}>
                  {t('callInitiated')}: {new Date(pendingCall.createdAt).toLocaleTimeString()}
                  {' · '}
                  {formatElapsed(callNow - new Date(pendingCall.createdAt).getTime())}
                </span>
              )}
              {resolvedCall?.resolvedAt && (
                <span className={styles.waiterCallMeta}>
                  {t('callAnsweredAt')}: {resolvedCall.resolvedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
            {pendingCall && (
              <button
                className={styles.waiterCallBtn}
                onClick={handleAcceptCall}
                disabled={acceptingCall}
              >
                {acceptingCall ? '…' : t('acceptCall')}
              </button>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        <div className={styles.statsRow}>
          <MicroStat
            label={t('status')}
            value={tableStatusLabel(tableInfo.status)}
            highlight={isWaiterCall}
          />
          <MicroStat label={t('currentOrder')} value={orders.length ? `#${orders[0].orderId}` : '—'} />
          <MicroStat label={t('total')} value={`${grandTotal.toFixed(0)}₴`} highlight />
        </div>

        {/* ── Order ── */}
        {loading ? (
          <div className={styles.noOrder}>{t('loading')}</div>
        ) : orders.length === 0 ? (
          <div className={styles.noOrder}>{t('noOrder')}</div>
        ) : (() => {
          const o = orders[0];
          const subTotal = o.items.reduce((s, i) => s + (i.price || 0), 0);
          return (
          <div className={styles.orderBox}>
            <div className={styles.orderHeader}>
              <p className={styles.orderTitle}>{t('currentOrder')} #{o.orderId}</p>
              <div className={styles.sepActions}>
                <button className={styles.addBtn} onClick={() => openAddPanel(o.orderId)}>
                  <MdAdd /> {t('addDishes')}
                </button>
                <button
                  className={`${styles.addBtn} ${styles.voidBtn}`}
                  onClick={() => voidingOrderId === o.orderId ? cancelVoid() : openVoid(o.orderId)}
                >
                  <MdBlock /> {t('voidOrder')}
                </button>
              </div>
            </div>

            {voidingOrderId === o.orderId && (
              <div className={styles.voidForm}>
                <textarea
                  className={styles.voidReasonInput}
                  value={voidReason}
                  onChange={e => { setVoidReason(e.target.value); setVoidError(''); }}
                  placeholder={t('voidReasonPlaceholder')}
                  rows={2}
                  autoFocus
                />
                {voidError && <span className={styles.voidError}>{voidError}</span>}
                <div className={styles.voidActions}>
                  <button className={styles.voidConfirmBtn} onClick={handleVoidOrder} disabled={voidSaving}>
                    {voidSaving ? '…' : t('confirmVoid')}
                  </button>
                  <button className={styles.voidCancelBtn} onClick={cancelVoid}>
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}

            {(() => {
              const renderItemsTable = (items) => (
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHead}>
                      <th>{t('dish')}</th>
                      <th style={{ width: 60 }}>{t('qty')}</th>
                      <th style={{ width: 80 }}>{t('sum')}</th>
                      <th>{t('statusCol')}</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const isEditing = editItem?.itemId === item.id && editItem?.orderId === o.orderId;
                      const displayName = item[fieldFor('name', i18n.language)] || item.name;
                      return (
                        <tr key={item.id} className={styles.tableRow}>
                          <td className={styles.td}>{displayName}</td>
                          <td className={styles.td}>
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                className={styles.qtyInput}
                                value={editItem.qty}
                                onChange={e => setEditItem(p => ({ ...p, qty: Number(e.target.value) }))}
                              />
                            ) : item.qty}
                          </td>
                          <td className={`${styles.td} ${styles.priceCell}`}>{item.price.toFixed(0)}₴</td>
                          <td className={styles.td}>
                            <span className={`${styles.badge} ${styles[item.status]}`}>
                              {dishStatusLabel[item.status] || item.status}
                            </span>
                          </td>
                          <td className={styles.td}>
                            {isEditing ? (
                              <div className={styles.rowActions}>
                                <button className={styles.saveBtn} onClick={saveEdit} title={t('confirm')}><MdCheck /></button>
                                <button className={styles.cancelBtn} onClick={() => setEditItem(null)} title={t('cancel')}><MdClose /></button>
                              </div>
                            ) : item.status === 'waiting' ? (
                              <div className={styles.rowActions}>
                                <button
                                  className={styles.iconBtn}
                                  title={t('editOrder')}
                                  onClick={() => setEditItem({ orderId: o.orderId, itemId: item.id, qty: item.qty, comment: item.comment })}
                                >
                                  <MdEdit />
                                </button>
                                <button
                                  className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                                  title={t('voidOrder')}
                                  onClick={() => handleDelete(o.orderId, item.id)}
                                >
                                  <MdDelete />
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );

              if (o.servingGroups?.length) {
                return (
                  <>
                    {o.servingGroups.map(group => {
                      const groupItems = o.items.filter(i => String(i.servingGroupId) === String(group._id));
                      if (!groupItems.length) return null;
                      return (
                        <div key={group._id} className={`${styles.servingGroup} ${styles[`group_${group.status}`] || ''}`}>
                          <div className={styles.servingGroupHeader}>
                            <span className={styles.servingGroupLabel}>
                              {t('servingGroup')} {(group.sortOrder ?? 0) + 1}
                            </span>
                            <span className={`${styles.badge} ${styles[group.status]}`}>
                              {t(`groupStatus_${group.status}`) || group.status}
                            </span>
                            {group.status === 'ready' && (
                              <button
                                className={styles.markServedBtn}
                                onClick={() => markGroupServed(o.orderId, group._id)}
                              >
                                <MdCheck /> {t('markServed')}
                              </button>
                            )}
                          </div>
                          {renderItemsTable(groupItems)}
                        </div>
                      );
                    })}
                    {/* ungrouped items */}
                    {(() => {
                      const ungrouped = o.items.filter(i => !i.servingGroupId);
                      return ungrouped.length ? renderItemsTable(ungrouped) : null;
                    })()}
                  </>
                );
              }
              return renderItemsTable(o.items);
            })()}
            <table className={styles.table}>
              <tbody>
                <tr className={styles.subTotalRow}>
                  <td colSpan={2} className={styles.subTotalLabel}>{t('total')}:</td>
                  <td colSpan={3} className={styles.subTotalVal}>{subTotal.toFixed(0)}₴</td>
                </tr>
              </tbody>
            </table>
          </div>
          );
        })()}

        {/* ── Add-items panel ── */}
        {addOrderId && (
          <div className={styles.addPanel}>
            <div className={styles.addPanelHeader}>
              <span className={styles.addPanelTitle}>{t('addDishesTo', { id: addOrderId })}</span>
              <button className={styles.closePanelBtn} onClick={() => setAddOrderId(null)}>
                <MdClose />
              </button>
            </div>

            <div className={styles.searchRow}>
              <MdSearch className={styles.searchIcon} />
              <input
                autoFocus
                className={styles.searchInput}
                placeholder={t('searchDish')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.menuList}>
              {filteredMenu.map(mi => (
                <div key={mi._id} className={styles.menuRow}>
                  <span className={styles.menuName}>{mi.name}</span>
                  <span className={styles.menuPrice}>{mi.basePrice}₴</span>
                  <div className={styles.qtyControl}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => setAddQtys(p => ({ ...p, [mi._id]: Math.max(0, (p[mi._id] || 0) - 1) }))}
                    >−</button>
                    <span className={styles.qtyVal}>{addQtys[mi._id] || 0}</span>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => setAddQtys(p => ({ ...p, [mi._id]: (p[mi._id] || 0) + 1 }))}
                    >+</button>
                  </div>
                </div>
              ))}
              {filteredMenu.length === 0 && (
                <p className={styles.noResults}>{t('noResults')}</p>
              )}
            </div>

            <div className={styles.addPanelFooter}>
              <button
                className={styles.submitAddBtn}
                disabled={addSaving || !Object.values(addQtys).some(q => q > 0)}
                onClick={submitAdd}
              >
                {addSaving ? t('saving') : t('confirm')}
              </button>
              <button className={styles.cancelAddBtn} onClick={() => setAddOrderId(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        <div className={styles.bottomRow}>
          <TableQrBlock
            tableId={tableInfo.id}
            shortCode={tableInfo.shortCode}
            tableName={tableInfo.name}
          />
          <TableHistoryBlock history={history} />
        </div>
      </div>
    </StaffShell>
  );
}
