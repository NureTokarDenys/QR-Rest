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
  getWaiterCalls, confirmWaiterCall,
} from '../../../api/orders';
import styles from './tableDetail.module.css';

import { MdEdit, MdDelete, MdAdd, MdCheck, MdClose, MdSearch } from 'react-icons/md';

function mapStatus(s) {
  if (!s) return 'free';
  if (s === 'occupied')    return 'busy';
  if (s === 'waiter_call') return 'waiter';
  if (s === 'reserved')    return 'reserved';
  return s;
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

  // add-items panel state
  const [addOrderId, setAddOrderId]   = useState(null);
  const [allMenuItems, setAllMenuItems] = useState([]);
  const [search, setSearch]           = useState('');
  const [addQtys, setAddQtys]         = useState({});
  const [addSaving, setAddSaving]     = useState(false);

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

      const refs = apiTable.currentOrders ?? (apiTable.currentOrder ? [apiTable.currentOrder] : []);

      const [loaded, hist, allCalls] = await Promise.all([
        Promise.all(
          refs.map(async ref => {
            const data  = await getOrder(ref._id);
            const items = (data?.items || []).map(i => ({
              id:      i._id,
              name:    i.menuItemId?.name || '—',
              qty:     i.qty ?? i.quantity ?? 1,
              price:   i.totalPrice ?? 0,
              status:  i.dishStatus || 'waiting',
              comment: i.comment || '',
            }));
            return { orderId: ref._id, order: data?.order, items };
          })
        ),
        getTableOrders(tableId),
        getWaiterCalls({ confirmed: 'false' }),
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
      await confirmWaiterCall(pendingCall._id);
      setPendingCall(null);
      load(); // refresh table status
    } catch (err) {
      console.error('confirmWaiterCall error:', err);
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
  const grandTotal   = orders.reduce((s, o) => s + o.items.reduce((s2, i) => s2 + (i.price || 0), 0), 0);
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
          <MicroStat label={t('orders')} value={orders.length} />
          <MicroStat label={t('total')} value={`${grandTotal.toFixed(0)}₴`} highlight />
        </div>

        {/* ── Orders table ── */}
        {loading ? (
          <div className={styles.noOrder}>{t('loading')}</div>
        ) : orders.length === 0 ? (
          <div className={styles.noOrder}>{t('noOrder')}</div>
        ) : (
          <div className={styles.orderBox}>
            <div className={styles.orderHeader}>
              <p className={styles.orderTitle}>{t('activeOrders')}</p>
            </div>

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

              {orders.map(o => {
                const subTotal = o.items.reduce((s, i) => s + (i.price || 0), 0);
                return (
                  <React.Fragment key={o.orderId}>

                    {/* ── Order section header ── */}
                    <tbody>
                      <tr className={styles.orderSepRow}>
                        <td colSpan={4} className={styles.orderSepCell}>
                          <div className={styles.orderSepInner}>
                            <span className={styles.orderSepId}>#{o.orderId}</span>
                            <span className={styles.orderSepTime}>{timeAgo(o.order?.createdAt, t)}</span>
                          </div>
                        </td>
                        <td className={styles.orderSepAction}>
                          <button className={styles.addBtn} onClick={() => openAddPanel(o.orderId)}>
                            <MdAdd /> {t('addDishes')}
                          </button>
                        </td>
                      </tr>
                    </tbody>

                    {/* ── Items ── */}
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

                            <td className={`${styles.td} ${styles.priceCell}`}>
                              {item.price.toFixed(0)}₴
                            </td>

                            <td className={styles.td}>
                              <span className={`${styles.badge} ${styles[item.status]}`}>
                                {dishStatusLabel[item.status] || item.status}
                              </span>
                            </td>

                            <td className={styles.td}>
                              {isEditing ? (
                                <div className={styles.rowActions}>
                                  <button className={styles.saveBtn} onClick={saveEdit} title={t('confirm')}>
                                    <MdCheck />
                                  </button>
                                  <button className={styles.cancelBtn} onClick={() => setEditItem(null)} title={t('cancel')}>
                                    <MdClose />
                                  </button>
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

                    {/* ── Sub-total ── */}
                    <tbody>
                      <tr className={styles.subTotalRow}>
                        <td colSpan={2} className={styles.subTotalLabel}>{t('subtotal')}:</td>
                        <td colSpan={3} className={styles.subTotalVal}>{subTotal.toFixed(0)}₴</td>
                      </tr>
                    </tbody>

                  </React.Fragment>
                );
              })}

              {/* ── Grand total (only when 2+ orders) ── */}
              {orders.length > 1 && (
                <tbody>
                  <tr className={styles.grandTotalRow}>
                    <td colSpan={2} className={styles.grandTotalLabel}>{t('grandTotal')}:</td>
                    <td colSpan={3} className={styles.grandTotalVal}>{grandTotal.toFixed(0)}₴</td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        )}

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
