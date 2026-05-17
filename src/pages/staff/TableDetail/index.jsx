import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import TableQrBlock from '../../../components/staff/TableQrBlock';
import TableHistoryBlock from '../../../components/staff/TableHistoryBlock';
import { getTables, getMenuItems } from '../../../api/admin';
import {
  getOrder, getTableOrders,
  addOrderItems, updateOrderItem, deleteOrderItem,
  voidOrder,
  getWaiterCalls, resolveWaiterCall,
  openTableRecovery,
} from '../../../api/orders';
import styles from './tableDetail.module.css';

import { MdEdit, MdDelete, MdAdd, MdCheck, MdClose, MdSearch, MdBlock } from 'react-icons/md';

function mapStatus(s) {
  if (!s) return 'free';
  if (s === 'occupied') return 'busy';
  return s; // free, disabled
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
  const { t }  = useTranslation('tableDetail');

  const [tableInfo, setTableInfo] = useState({
    id, status: 'free', seats: 4, name: `Стіл ${id}`,
  });
  const [orders, setOrders]         = useState([]);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pendingCall, setPendingCall] = useState(null);
  const [acceptingCall, setAcceptingCall] = useState(false);

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
      const allTables = await getTables();
      if (!Array.isArray(allTables)) return;

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
        _id:       tableId,
        shortCode: apiTable.shortCode || null,
      });

      const ref = apiTable.currentOrder ?? null;

      const [loaded, hist, allCalls] = await Promise.all([
        ref
          ? getOrder(ref._id).then(data => {
              const items = (data?.items || []).map(i => ({
                id:      i._id,
                name:    i.menuItemId?.name || '—',
                qty:     i.qty ?? i.quantity ?? 1,
                price:   i.totalPrice ?? 0,
                status:  i.dishStatus || 'waiting',
                comment: i.comment || '',
              }));
              return [{ orderId: ref._id, order: data?.order, items }];
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
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Accept waiter call ───────────────────────────────────────────────────────
  async function handleAcceptCall() {
    if (!pendingCall) return;
    setAcceptingCall(true);
    try {
      await resolveWaiterCall(pendingCall._id);
      setPendingCall(null);
      load(); // refresh table status
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

  // ── Add-items panel ──────────────────────────────────────────────────────────
  async function openAddPanel(orderId) {
    setAddOrderId(orderId);
    setAddQtys({});
    setSearch('');
    if (!allMenuItems.length) {
      try {
        const items = await getMenuItems();
        setAllMenuItems((items || []).filter(m => m.isAvailable && !m.isDeleted));
      } catch (err) {
        console.error('getMenuItems error:', err);
      }
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

  return (
    <StaffShell
      title={`${t('title')} ${tableInfo.id}${isWaiterCall ? ` — ${t('waiterCall')}` : ''}`}
      backTo="/staff/map"
    >
      <div className={styles.page}>

        {/* ── Header ── */}
        <div className={styles.top}>
          <div className={styles.titleBlock}>
            <h2 className={styles.tableTitle}>{tableInfo.name}</h2>
            <p className={styles.tableSub}>{t('hall')} A · {tableInfo.seats} {t('seats')}</p>
          </div>

          <div className={styles.scanWindowRow}>
            {countdown !== null ? (
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
            )}
          </div>
        </div>

        {/* ── Waiter call banner ── */}
        {(pendingCall || isWaiterCall) && (
          <div className={styles.waiterCallBanner}>
            <span className={styles.waiterCallText}>🔔 {t('waiterCall')}</span>
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
                {o.items.map(item => {
                  const isEditing = editItem?.itemId === item.id && editItem?.orderId === o.orderId;
                  return (
                    <tr key={item.id} className={styles.tableRow}>
                      <td className={styles.td}>{item.name}</td>
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
