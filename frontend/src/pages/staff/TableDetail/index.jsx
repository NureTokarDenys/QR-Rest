import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import TableQrBlock from '../../../components/staff/TableQrBlock';
import TableHistoryBlock from '../../../components/staff/TableHistoryBlock';
import WsStatusBanner from '../../../components/WsStatusBanner';
import { Skel } from '../../../components/staff/Skeleton';
import { useLocalField } from '../../../i18n/useLang';
import { useAuth } from '../../../context/AuthContext';
import { updateTable } from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import {
  getOrder, getTableOrders,
  addOrderItems, deleteOrderItem,
  voidOrder, closeOrder,
  getWaiterCalls, resolveWaiterCall,
  openTableRecovery,
  createWaiterOrder,
  revertPayment,
} from '../../../api/orders';
import { updateGroupStatus } from '../../../api/kitchen';
import { useWebSocket } from '../../../hooks/useWebSocket';
import MenuPickerModal from '../../../components/staff/MenuPickerModal';
import DishEditModal from '../../../components/staff/DishEditModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import styles from './tableDetail.module.css';

import { MdEdit, MdDelete, MdAdd, MdBlock, MdAccountCircle, MdPayments, MdUndo, MdCheck } from 'react-icons/md';

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
  const navigate = useNavigate();
  const { t } = useTranslation('tableDetail');
  const local = useLocalField();
  const { user } = useAuth();
  const isAdmin = ['admin', 'root_admin'].includes(user?.role);
  // Shared cache: tables + menu items are lazy-loaded the first time this page
  // (or any other page that needs them) is opened, then kept fresh via WS.
  const { tables: cachedTables, menuItems: cachedMenu, refreshTables, ensureTables, ensureMenuItems } = useStaffData();
  const canManageMenu = ['admin', 'root_admin', 'cook', 'waiter_cook'].includes(user?.role);
  useEffect(() => {
    ensureTables();
    if (canManageMenu) ensureMenuItems();
  }, [ensureTables, ensureMenuItems, canManageMenu]);

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

  // dish edit modal state
  const [editingItem,    setEditingItem]    = useState(null); // full item passed to DishEditModal
  // delete confirm state — { orderId, itemId } or null
  const [deletingTarget, setDeletingTarget] = useState(null);

  // void order state
  const [voidingOrderId, setVoidingOrderId] = useState(null);
  const [voidReason, setVoidReason]         = useState('');
  const [voidSaving, setVoidSaving]         = useState(false);
  const [voidError, setVoidError]           = useState('');

  // close (pay cash / complete) order state
  const [closingOrderId, setClosingOrderId] = useState(null); // orderId pending confirmation

  // revert cash payment state
  const [revertingOrderId, setRevertingOrderId] = useState(null);
  const [revertLoading,    setRevertLoading]     = useState(false);

  // create-order state
  const [creatingOrder, setCreatingOrder] = useState(false);

  // recovery-window state
  const [recoveryWindowUntil, setRecoveryWindowUntil] = useState(null); // Date | null
  const [recoveryOpening, setRecoveryOpening]         = useState(false);
  const [countdown, setCountdown]                     = useState(null); // seconds remaining | null

  // menu-picker modal state
  const [addOrderId, setAddOrderId] = useState(null);

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

  // Auto-dismiss the "call accepted" banner after 10 seconds
  useEffect(() => {
    if (!resolvedCall) return;
    const id = setTimeout(() => setResolvedCall(null), 10_000);
    return () => clearTimeout(id);
  }, [resolvedCall]);

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

  // ── Create order (waiter) ────────────────────────────────────────────────────
  async function handleCreateOrder() {
    if (!tableInfo._id) return;
    setCreatingOrder(true);
    try {
      const data = await createWaiterOrder(tableInfo._id);
      if (data?.orderId) openAddPanel(data.orderId);
      await refreshTables();
      await load();
    } catch (err) {
      console.error('createWaiterOrder error:', err);
    } finally {
      setCreatingOrder(false);
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

  // ── Order status label map ────────────────────────────────────────────────────
  function orderStatusLabel(status) {
    switch (status) {
      case 'open':           return t('orderStatusOpen');
      case 'open_paid':      return t('orderStatusOpenPaid');
      case 'completed_cash': return t('orderStatusCompletedCash');
      case 'completed_epay': return t('orderStatusCompletedEpay');
      case 'cancelled':      return t('orderStatusCancelled');
      default:               return '—';
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
              // Store both languages flat — the render layer picks the right
              // one reactively via useLocalField. No need to re-fetch on lang change.
              const items = (data?.items || []).map(i => {
                const mi = typeof i.menuItemId === 'object' ? i.menuItemId : null;
                return ({
                id:                    i._id,
                name:                  mi?.name    || i.name    || i.menuItemName    || '—',
                name_en:               mi?.name_en || i.name_en || i.menuItemName_en || null,
                qty:                   i.qty ?? i.quantity ?? 1,
                price:                 i.totalPrice ?? 0,
                status:                i.dishStatus || 'waiting',
                comment:               i.comment || '',
                servingGroupId:        i.servingGroupId || null,
                menuItemId:            i.menuItemId_raw || (i.menuItemId?._id ? String(i.menuItemId._id) : null),
                excludedIngredients:   i.excludedIngredients   || [],
                addons:                i.addons                || [],
                componentGroupChoices: i.componentGroupChoices || [],
              });
              });
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
  }, [id, cachedTables]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Keep a ref to tableInfo so the WS handler can filter by table without
  // being recreated every time tableInfo changes.
  const tableInfoRef = useRef(tableInfo);
  useEffect(() => { tableInfoRef.current = tableInfo; }, [tableInfo]);

  const RELOAD_EVENTS = new Set([
    'ORDER_NEW', 'ORDER_UPDATED', 'ORDER_VOID', 'ORDER_CANCELLED', 'ORDER_COMPLETED',
    'DISH_STATUS_UPDATED', 'GROUP_STATUS_UPDATED', 'ORDER_ITEMS_ADDED',
    'PAYMENT_COMPLETED',
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
      setResolvedCall({ resolvedAt: new Date(), type: pendingCall.type });
      setPendingCall(null);
      load();
    } catch (err) {
      console.error('resolveWaiterCall error:', err);
    } finally {
      setAcceptingCall(false);
    }
  }

  // ── Edit item (full dish modal) ──────────────────────────────────────────────
  function openEditItem(item) {
    setEditingItem(item);
    setDeletingTarget(null);
  }

  async function handleEditSaved() {
    setEditingItem(null);
    await refreshTables();
    await load();
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
    const currentItems = orders[0]?.items || [];
    const allWaiting = currentItems.length === 0 || currentItems.every(i => i.status === 'waiting');

    if (!allWaiting && voidReason.trim().length < 10) {
      setVoidError(t('voidReasonTooShort'));
      return;
    }
    setVoidSaving(true);
    setVoidError('');
    try {
      await voidOrder(voidingOrderId, voidReason.trim());
      cancelVoid();
      await refreshTables();
      await load();
    } catch (err) {
      console.error('voidOrder error:', err);
      setVoidError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        t('voidReasonTooShort')
      );
    } finally {
      setVoidSaving(false);
    }
  }

  // ── Close (pay cash / complete pre-paid) order ───────────────────────────────
  async function handleCloseOrder() {
    if (!closingOrderId) return;
    try {
      await closeOrder(closingOrderId);
      setClosingOrderId(null);
      await refreshTables();
      await load();
    } catch (err) {
      console.error('closeOrder error:', err);
      setClosingOrderId(null);
    }
  }

  // ── Revert cash payment ──────────────────────────────────────────────────────
  async function handleRevertPayment() {
    if (!revertingOrderId) return;
    setRevertLoading(true);
    try {
      await revertPayment(revertingOrderId);
      setRevertingOrderId(null);
      await refreshTables();
      await load();
    } catch (err) {
      console.error('revertPayment error:', err);
      setRevertingOrderId(null);
    } finally {
      setRevertLoading(false);
    }
  }

  // ── Delete item (inline two-step confirm) ────────────────────────────────────
  async function confirmDelete() {
    if (!deletingTarget) return;
    const { orderId, itemId } = deletingTarget;
    try {
      await deleteOrderItem(orderId, itemId);
      setDeletingTarget(null);
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

  // ── Menu picker ──────────────────────────────────────────────────────────────
  function openAddPanel(orderId) {
    setAddOrderId(orderId);
  }

  async function handleMenuPickerConfirm(items) {
    await addOrderItems(addOrderId, items, t('addedByWaiter'));
    setAddOrderId(null);
    await refreshTables();
    await load();
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const grandTotal = orders[0]?.items.reduce((s, i) => s + (i.price || 0), 0) ?? 0;

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
          <div className={`${styles.waiterCallBanner} ${resolvedCall ? styles.waiterCallBannerResolved : ''} ${(pendingCall?.type === 'cash_payment' || resolvedCall?.type === 'cash_payment') ? styles.waiterCallBannerCash : ''}`}>
            <div className={styles.waiterCallInfo}>
              <span className={styles.waiterCallText}>
                {resolvedCall
                  ? (resolvedCall.type === 'cash_payment' ? `✅ ${t('callAnsweredCash')}` : `✅ ${t('callAnswered')}`)
                  : (pendingCall?.type === 'cash_payment'  ? `💳 ${t('waiterCallCash')}` : `🔔 ${t('waiterCall')}`)}
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
            label={t('tableStatus')}
            value={tableStatusLabel(tableInfo.status)}
            highlight={isWaiterCall}
          />
          <MicroStat
            label={t('orderStatus')}
            value={orders.length ? orderStatusLabel(orders[0].order?.status) : '—'}
            action={
              orders.length &&
              ['open_paid', 'completed_cash'].includes(orders[0].order?.status) &&
              orders[0].order?.paymentMethod === 'cash'
                ? (
                  <button
                    className={styles.revertBtn}
                    onClick={() => setRevertingOrderId(orders[0].orderId)}
                    disabled={revertLoading}
                  >
                    <MdUndo /> {t('revertPayment')}
                  </button>
                )
                : null
            }
          />
          <MicroStat label={t('total')} value={`${grandTotal.toFixed(0)}₴`} highlight />
        </div>

        {/* ── Order ── */}
        {loading ? (
          <div className={styles.noOrder}>{t('loading')}</div>
        ) : orders.length === 0 ? (
          <div className={styles.noOrder}>
            <span>{t('noOrder')}</span>
            {tableInfo.status === 'free' && (
              <button
                className={styles.createOrderBtn}
                onClick={handleCreateOrder}
                disabled={creatingOrder}
              >
                <MdAdd /> {creatingOrder ? '…' : t('createOrder')}
              </button>
            )}
          </div>
        ) : (() => {
          const o = orders[0];
          const subTotal  = o.items.reduce((s, i) => s + (i.price || 0), 0);
          const isPaid    = o.order?.status === 'open_paid';
          const allServed = o.items.length > 0 && o.items.every(i => i.status === 'served');
          const canClose  = o.order?.status === 'open' || o.order?.status === 'open_paid';
          return (
          <div className={styles.orderBox}>
            <div className={styles.orderHeader}>
              <button
                className={styles.orderIdLink}
                onClick={() => navigate(`/staff/order/${o.orderId}`, { state: { from: `/staff/table/${id}` } })}
              >
                {t('currentOrder')} #{o.orderId}
              </button>
              <div className={styles.sepActions}>
                {(isAdmin || !isPaid) && (
                  <>
                    <button className={styles.addBtn} onClick={() => openAddPanel(o.orderId)}>
                      <MdAdd /> {t('addDishes')}
                    </button>
                    <button
                      className={`${styles.addBtn} ${styles.voidBtn}`}
                      onClick={() => voidingOrderId === o.orderId ? cancelVoid() : openVoid(o.orderId)}
                    >
                      <MdBlock /> {t('voidOrder')}
                    </button>
                  </>
                )}
                {canClose && (
                  <button
                    className={`${styles.addBtn} ${allServed ? styles.payBtn : styles.payBtnPending}`}
                    onClick={() => setClosingOrderId(o.orderId)}
                  >
                    <MdPayments /> {isPaid ? t('completeOrder') : t('payCash')}
                  </button>
                )}
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
                      const displayName = local(item, 'name') || item.name;
                      return (
                        <tr key={item.id} className={styles.tableRow}>
                          <td className={styles.td}>{displayName}</td>
                          <td className={styles.td}>{item.qty}</td>
                          <td className={`${styles.td} ${styles.priceCell}`}>{item.price.toFixed(0)}₴</td>
                          <td className={styles.td}>
                            <span className={`${styles.badge} ${styles[item.status]}`}>
                              {dishStatusLabel[item.status] || item.status}
                            </span>
                          </td>
                          <td className={styles.td}>
                            {(isAdmin || (!isPaid && item.status === 'waiting')) && (
                              <div className={styles.rowActions}>
                                <button
                                  className={styles.iconBtn}
                                  title={t('editOrder')}
                                  onClick={() => openEditItem(item)}
                                >
                                  <MdEdit />
                                </button>
                                <button
                                  className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                                  title={t('deleteItem')}
                                  onClick={() => setDeletingTarget({ orderId: o.orderId, itemId: item.id })}
                                >
                                  <MdDelete />
                                </button>
                              </div>
                            )}
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

        {/* ── Menu picker modal ── */}
        {addOrderId && (
          <MenuPickerModal
            orderId={addOrderId}
            onClose={() => setAddOrderId(null)}
            onConfirm={handleMenuPickerConfirm}
          />
        )}

        {/* ── Dish edit modal ── */}
        {editingItem && orders[0] && (
          <DishEditModal
            orderId={orders[0].orderId}
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSaved={handleEditSaved}
          />
        )}

        {/* ── Delete confirmation ── */}
        <ConfirmDialog
          open={!!deletingTarget}
          title={t('deleteItemConfirm')}
          confirmLabel={t('deleteYes')}
          cancelLabel={t('cancel')}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingTarget(null)}
          danger
        />

        {/* ── Close order confirmation ── */}
        <ConfirmDialog
          open={!!closingOrderId}
          title={(() => {
            const o = orders[0];
            return (o?.order?.status === 'open_paid') ? t('completeOrderConfirm') : t('payCashConfirm');
          })()}
          confirmLabel={(() => {
            const o = orders[0];
            return (o?.order?.status === 'open_paid') ? t('completeOrder') : t('payCash');
          })()}
          cancelLabel={t('cancel')}
          onConfirm={handleCloseOrder}
          onCancel={() => setClosingOrderId(null)}
          danger={false}
        />

        {/* ── Revert payment confirmation ── */}
        <ConfirmDialog
          open={!!revertingOrderId}
          title={t('revertPaymentConfirm')}
          confirmLabel={t('revertPayment')}
          cancelLabel={t('cancel')}
          onConfirm={handleRevertPayment}
          onCancel={() => setRevertingOrderId(null)}
          danger={true}
        />

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
