import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DishEditModal from '../../../components/staff/DishEditModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import MicroStat from '../../../components/staff/MicroStat';
import WsStatusBanner from '../../../components/WsStatusBanner';
import { useLocalField } from '../../../i18n/useLang';
import { useAuth } from '../../../context/AuthContext';
import {
  getOrder,
  addOrderItems, deleteOrderItem,
  voidOrder, closeOrder, revertPayment,
} from '../../../api/orders';
import { useStaffData } from '../../../context/StaffDataContext';
import { updateItemStatus, updateGroupStatus } from '../../../api/kitchen';
import { useWebSocket } from '../../../hooks/useWebSocket';
import styles from './orderDetail.module.css';

import { MdEdit, MdDelete, MdAdd, MdCheck, MdClose, MdSearch, MdBlock, MdPayments, MdUndo } from 'react-icons/md';
// MdCheck, MdClose kept for void form buttons

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_SEQ = ['waiting', 'cooking', 'ready', 'served'];

const STATUS_META = {
  waiting: { color: '#1d7afc', bg: '#e8f4ff' },
  cooking: { color: '#f57c00', bg: '#fff3e0' },
  ready:   { color: '#16a34a', bg: '#f0fdf4' },
  served:  { color: '#0369a1', bg: '#f0f9ff' },
};

const ORDER_STATUS_META = {
  pending:   { color: '#6b7280', bg: '#f3f4f6' },
  confirmed: { color: '#1d7afc', bg: '#e8f4ff' },
  active:    { color: '#f57c00', bg: '#fff3e0' },
  ready:     { color: '#16a34a', bg: '#f0fdf4' },
  completed: { color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { color: '#dc2626', bg: '#fef2f2' },
  void:      { color: '#dc2626', bg: '#fef2f2' },
  draft:     { color: '#9ca3af', bg: '#f9fafb' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGroupStatus(items) {
  if (!items.length) return 'waiting';
  const ss = items.map(i => i.status || 'waiting');
  if (ss.every(s => s === 'served')) return 'served';
  if (ss.every(s => s === 'ready' || s === 'served')) return 'ready';
  if (ss.some(s => s === 'cooking' || s === 'ready')) return 'cooking';
  return 'waiting';
}

function normaliseOrder(raw) {
  if (!raw) return null;
  const orderData = raw.order || raw;
  const rawItems  = raw.items || orderData.items || [];
  const orderId   = orderData._id || orderData.id;

  // Store both languages flat — the render layer picks the right one
  // reactively via useLocalField. No language parameter needed here.
  const items = rawItems.map(i => {
    const mi = typeof i.menuItemId === 'object' ? i.menuItemId : null;
    return {
      id:             i._id || i.id,
      orderId,
      name:           mi?.name    || i.name    || '—',
      name_en:        mi?.name_en || i.name_en || null,
      qty:            i.qty ?? i.quantity ?? 1,
      price:          i.totalPrice ?? i.unitPrice ?? i.price ?? 0,
      status:         i.dishStatus || i.status || 'waiting',
      comment:        i.comment || '',
      servingGroupId: i.servingGroupId ? String(i.servingGroupId) : null,
      menuItemId:     i.menuItemId_raw || (mi ? String(mi._id || '') : String(i.menuItemId || '')),
      excludedIngredients:    i.excludedIngredients    || [],
      addons:                 i.addons                 || [],
      componentGroupChoices:  i.componentGroupChoices  || [],
    };
  });

  const servingGroups = (raw.servingGroups || orderData.servingGroups || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(g => ({
      id:        String(g._id || g.id),
      name:      g.name || '',
      sortOrder: g.sortOrder ?? 0,
      status:    getGroupStatus(items.filter(i => i.servingGroupId === String(g._id || g.id))),
    }));

  return {
    id:            orderId,
    tableNumber:   orderData.tableNumber ?? null,
    tableObjectId: orderData.tableId ?? null,
    tableId:       orderData.tableNumber ?? orderData.tableId ?? '—',
    time:          orderData.createdAt
                     ? new Date(orderData.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
                     : '—',
    status:        orderData.status || 'active',
    paymentMethod: orderData.paymentMethod ?? null,
    comment:       orderData.comment || '',
    total:         orderData.totalAmount ?? orderData.total ?? items.reduce((s, i) => s + i.price, 0),
    items,
    servingGroups,
  };
}

// ── 4-dot status component ────────────────────────────────────────────────────

function StatusDots({ status, onChange }) {
  const currentIdx = STATUS_SEQ.indexOf(status);
  return (
    <div className={styles.statusDots}>
      {STATUS_SEQ.map((s, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isNext    = idx === currentIdx + 1;
        const canClick  = isNext && !!onChange;
        const meta      = STATUS_META[s];
        return (
          <React.Fragment key={s}>
            {idx > 0 && (
              <span
                className={`${styles.dotConnector} ${idx <= currentIdx ? styles.dotConnectorFilled : ''}`}
                style={idx <= currentIdx ? { background: STATUS_META[STATUS_SEQ[idx - 1]]?.color } : undefined}
              />
            )}
            <button
              type="button"
              className={`${styles.dot}
                ${isDone    ? styles.dotDone    : ''}
                ${isCurrent ? styles.dotCurrent : ''}
                ${isNext    ? styles.dotNext    : ''}
                ${canClick  ? styles.dotClickable : ''}
              `}
              style={(isDone || isCurrent) ? { background: meta?.color, borderColor: meta?.color, '--dot-color': meta?.color } : undefined}
              disabled={!canClick}
              onClick={() => canClick && onChange(s)}
              title={s.charAt(0).toUpperCase() + s.slice(1)}
            >
              {isCurrent && <span className={styles.dotGlow} style={{ '--dot-color': meta?.color }} />}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('orderDetail');
  const local = useLocalField();
  const { user } = useAuth();
  const { menuItems: cachedMenu } = useStaffData();

  const canEdit = ['admin', 'waiter', 'waiter_cook'].includes(user?.role);
  const isAdmin = ['admin', 'root_admin'].includes(user?.role);
  const defaultBack = user?.role === 'cook' ? '/staff/cooking' : '/staff/orders';
  const backTo = location.state?.from ?? defaultBack;

  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);

  const [editingItem,    setEditingItem]    = useState(null); // full item for DishEditModal
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [closingOrder,   setClosingOrder]   = useState(false); // confirm dialog open
  const [voidingOpen, setVoidingOpen] = useState(false);
  const [voidReason,  setVoidReason]  = useState('');
  const [voidSaving,  setVoidSaving]  = useState(false);
  const [voidError,   setVoidError]   = useState('');

  const [revertConfirm, setRevertConfirm] = useState(false);
  const [revertLoading, setRevertLoading] = useState(false);

  const [addOpen,      setAddOpen]      = useState(false);
  const [allMenuItems, setAllMenuItems] = useState([]);
  const [search,       setSearch]       = useState('');
  const [addQtys,      setAddQtys]      = useState({});
  const [addSaving,    setAddSaving]    = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      const raw  = await getOrder(id);
      const norm = normaliseOrder(raw);
      if (norm) setOrder(norm);
    } catch (err) {
      console.error('getOrder error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleWsMessage = useCallback((msg) => {
    const RELOAD = new Set(['DISH_STATUS_UPDATED', 'GROUP_STATUS_UPDATED', 'ORDER_UPDATED', 'ORDER_ITEMS_ADDED', 'PAYMENT_COMPLETED']);
    if (!RELOAD.has(msg.event)) return;
    const p = msg.payload;
    if (p?.orderId && String(p.orderId) !== String(id)) return;
    load();
  }, [load, id]);

  const { status: wsStatus } = useWebSocket({ onMessage: handleWsMessage });

  // ── Dish status ───────────────────────────────────────────────────────────

  async function handleDishStatus(itemId, newStatus) {
    setOrder(prev => {
      if (!prev) return prev;
      const items = prev.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i);
      const servingGroups = prev.servingGroups.map(g => ({
        ...g,
        status: getGroupStatus(items.filter(i => i.servingGroupId === g.id)),
      }));
      return { ...prev, items, servingGroups };
    });
    try {
      await updateItemStatus(id, itemId, newStatus);
    } catch (err) {
      console.error('updateItemStatus error:', err);
      load();
    }
  }

  async function handleMarkServed(groupId) {
    try {
      await updateGroupStatus(id, groupId, 'served');
      load();
    } catch (err) {
      console.error('updateGroupStatus error:', err);
    }
  }

  // ── Edit item (full dish modal) ───────────────────────────────────────────

  async function handleEditSaved() {
    setEditingItem(null);
    load();
  }

  // ── Delete item (inline two-step confirm) ─────────────────────────────────

  async function confirmDelete(itemId) {
    try {
      await deleteOrderItem(id, itemId);
      setDeletingItemId(null);
      load();
    } catch (err) {
      console.error('deleteOrderItem error:', err);
    }
  }

  // ── Close order (manual pay cash / complete pre-paid) ────────────────────

  async function handleCloseOrder() {
    try {
      await closeOrder(id);
      setClosingOrder(false);
      load();
    } catch (err) {
      console.error('closeOrder error:', err);
      setClosingOrder(false);
    }
  }

  // ── Void ─────────────────────────────────────────────────────────────────

  async function handleVoid() {
    if (voidReason.trim().length < 10) { setVoidError(t('voidReasonTooShort', 'Мінімум 10 символів')); return; }
    setVoidSaving(true);
    setVoidError('');
    try {
      await voidOrder(id, voidReason.trim());
      setVoidingOpen(false);
      load();
    } catch (err) {
      setVoidError(err?.response?.data?.message || t('voidError', 'Помилка'));
    } finally {
      setVoidSaving(false);
    }
  }

  // ── Revert cash payment ───────────────────────────────────────────────────

  async function handleRevertPayment() {
    setRevertLoading(true);
    try {
      await revertPayment(id);
      setRevertConfirm(false);
      load();
    } catch (err) {
      console.error('revertPayment error:', err);
    } finally {
      setRevertLoading(false);
    }
  }

  // ── Add items ─────────────────────────────────────────────────────────────

  async function openAdd() {
    setAddOpen(true);
    setAddQtys({});
    setSearch('');
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
      await addOrderItems(id, items);
      setAddOpen(false);
      load();
    } catch (err) {
      console.error('addOrderItems error:', err);
    } finally {
      setAddSaving(false);
    }
  }

  const filteredMenu = allMenuItems.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Dish row renderer ─────────────────────────────────────────────────────

  function renderDishRow(item) {
    const displayName        = local(item, 'name') || item.name;
    const rowOrderActive     = order?.status === 'open';
    const canAdvanceStatus   = isAdmin ? ['open', 'open_paid'].includes(order?.status) : rowOrderActive;
    const showEdit           = isAdmin || (canEdit && rowOrderActive && item.status === 'waiting');
    const isDeleting     = deletingItemId === item.id;

    const excluded = (item.excludedIngredients || [])
      .map(x => local(x, 'name')).filter(Boolean);
    const addonsList = (item.addons || [])
      .map(ao => {
        const src = typeof ao.addonId === 'object' && ao.addonId ? ao.addonId : ao;
        const n   = local(src, 'name') || local(ao.addon, 'name') || ao.name;
        return n ? (ao.quantity > 1 ? `${n} ×${ao.quantity}` : n) : null;
      }).filter(Boolean);
    const choices = (item.componentGroupChoices || [])
      .map(c => {
        const grpSrc = typeof c.groupId  === 'object' && c.groupId  ? c.groupId  : null;
        const optSrc = typeof c.optionId === 'object' && c.optionId ? c.optionId : null;
        const grp    = local(grpSrc, 'name') || c.groupName  || '';
        const opt    = local(optSrc, 'name') || c.optionName || '';
        return grp && opt ? `${grp}: ${opt}` : opt || grp || null;
      }).filter(Boolean);

    const hasExtras = excluded.length || addonsList.length || choices.length || item.comment;

    return (
      <div key={item.id} className={styles.dishRow}>
        <div className={styles.dishMain}>
          <div className={styles.dishInfo}>
            <span className={styles.dishQty}>×{item.qty}</span>
            <span className={styles.dishName}>{displayName}</span>
          </div>
          <span className={styles.dishPrice}>{item.price.toFixed(0)}₴</span>
        </div>

        {hasExtras && (
          <div className={styles.dishExtras}>
            {excluded.map((n, i)   => <span key={i} className={`${styles.extraTag} ${styles.extraExcluded}`}>−{n}</span>)}
            {addonsList.map((n, i) => <span key={i} className={`${styles.extraTag} ${styles.extraAddon}`}>+{n}</span>)}
            {choices.map((n, i)    => <span key={i} className={`${styles.extraTag} ${styles.extraChoice}`}>{n}</span>)}
            {item.comment && <span className={styles.dishComment}>«{item.comment}»</span>}
          </div>
        )}

        <div className={styles.dishBottom}>
          <StatusDots
            status={item.status}
            onChange={canAdvanceStatus ? newStatus => handleDishStatus(item.id, newStatus) : null}
          />
          <div className={styles.dishActions}>
            {showEdit && (
              <>
                <button className={styles.iconBtn} title={t('editItem')} onClick={() => setEditingItem(item)}><MdEdit /></button>
                <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title={t('deleteItem')} onClick={() => setDeletingItemId(item.id)}><MdDelete /></button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <StaffShell title={t('title', 'Замовлення')} backTo={backTo}>
      <p style={{ padding: '2rem', color: 'var(--secondary-text)' }}>{t('loading', 'Завантаження…')}</p>
    </StaffShell>
  );

  if (!order) return (
    <StaffShell title={t('title', 'Замовлення')} backTo={backTo}>
      <p style={{ padding: '2rem', color: 'var(--secondary-text)' }}>{t('notFound', 'Замовлення не знайдено')}</p>
    </StaffShell>
  );

  const orderStatusMeta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.active;
  const isOrderActive   = order.status === 'open';

  return (
    <StaffShell
      title={`${t('title', 'Замовлення')} #${String(order.id).slice(-6)}`}
      backTo={backTo}
    >
      <WsStatusBanner status={wsStatus} />
      <div className={styles.page}>

        {/* ── Stats ── */}
        <div className={styles.statsRow}>
          <MicroStat
            label={t('table', 'Стіл')}
            value={
              order.tableObjectId ? (
                <button
                  className={styles.tableLinkBtn}
                  onClick={() => navigate(`/staff/table/${order.tableObjectId}`)}
                >
                  № {order.tableId}
                </button>
              ) : `№ ${order.tableId}`
            }
          />
          <MicroStat label={t('time', 'Час')}   value={order.time} />
          <MicroStat label={t('total', 'Сума')} value={`${order.total}₴`} highlight />
          <div className={styles.orderStatusChip} style={{ background: orderStatusMeta.bg, color: orderStatusMeta.color }}>
            <span className={styles.chipLabel}>{t(`orderStatus_${order.status}`, order.status)}</span>
            <span className={styles.chipDesc}>{t(`orderStatusDesc_${order.status}`, '')}</span>
          </div>
        </div>

        {/* ── Action bar (waiter/admin only) ── */}
        {(() => {
          const allServed   = order.items.length > 0 && order.items.every(i => i.status === 'served');
          const showAddVoid  = isAdmin ? isOrderActive : (canEdit && isOrderActive);
          const showPayClose = canEdit && ['open', 'open_paid'].includes(order.status);
          const showRevert   = canEdit && ['open_paid', 'completed_cash'].includes(order.status) && order.paymentMethod === 'cash';
          if (!showAddVoid && !showPayClose && !showRevert) return null;
          return (
            <div className={styles.actionBar}>
              {showAddVoid && (
                <>
                  <button className={styles.actionBtn} onClick={openAdd}>
                    <MdAdd /> {t('addDishes', 'Додати страви')}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    onClick={() => { setVoidingOpen(v => !v); setVoidReason(''); setVoidError(''); }}
                  >
                    <MdBlock /> {t('voidOrder', 'Анулювати')}
                  </button>
                </>
              )}
              {showPayClose && (
                <button
                  className={`${styles.actionBtn} ${allServed ? styles.actionBtnSuccess : styles.actionBtnWarning}`}
                  onClick={() => setClosingOrder(true)}
                >
                  <MdPayments /> {order.status === 'open_paid' ? t('completeOrder') : t('payCash')}
                </button>
              )}
              {showRevert && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => setRevertConfirm(true)}
                  disabled={revertLoading}
                >
                  <MdUndo /> {t('revertPayment')}
                </button>
              )}
            </div>
          );
        })()}

        {/* ── Void form ── */}
        {voidingOpen && (
          <div className={styles.voidForm}>
            <textarea
              className={styles.voidReasonInput}
              value={voidReason}
              onChange={e => { setVoidReason(e.target.value); setVoidError(''); }}
              placeholder={t('voidReasonPlaceholder', 'Причина анулювання (мін. 10 символів)…')}
              rows={2}
              autoFocus
            />
            {voidError && <span className={styles.voidError}>{voidError}</span>}
            <div className={styles.voidActions}>
              <button className={styles.voidConfirmBtn} onClick={handleVoid} disabled={voidSaving}>
                {voidSaving ? '…' : t('confirmVoid', 'Підтвердити')}
              </button>
              <button className={styles.voidCancelBtn} onClick={() => setVoidingOpen(false)}>
                {t('cancel', 'Скасувати')}
              </button>
            </div>
          </div>
        )}

        {/* ── Serving groups ── */}
        {order.servingGroups.length > 0
          ? order.servingGroups.map(group => {
              const groupItems = order.items.filter(i => i.servingGroupId === group.id);
              if (!groupItems.length) return null;
              const gMeta = STATUS_META[group.status] || STATUS_META.waiting;
              return (
                <div key={group.id} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <span className={styles.groupLabel}>
                      {group.name || `${t('servingGroup', 'Подача')} ${group.sortOrder + 1}`}
                    </span>
                    <span
                      className={styles.groupStatusBadge}
                      style={{ background: gMeta.color + '22', color: gMeta.color }}
                    >
                      {t(`dishStatus_${group.status}`, group.status)}
                    </span>
                    {group.status === 'ready' && canEdit && (
                      <button className={styles.markServedBtn} onClick={() => handleMarkServed(group.id)}>
                        <MdCheck /> {t('markServed', 'Позначити подано')}
                      </button>
                    )}
                  </div>
                  <div className={styles.dishList}>
                    {groupItems.map(item => renderDishRow(item))}
                  </div>
                </div>
              );
            })
          : (
            <div className={styles.groupCard}>
              <div className={styles.dishList}>
                {order.items.map(item => renderDishRow(item))}
              </div>
            </div>
          )
        }

        {/* Ungrouped items (when groups exist) */}
        {order.servingGroups.length > 0 && (() => {
          const ungrouped = order.items.filter(i => !i.servingGroupId);
          if (!ungrouped.length) return null;
          return (
            <div className={styles.groupCard}>
              <div className={styles.groupHeader}>
                <span className={styles.groupLabel}>{t('ungrouped', 'Без групи')}</span>
              </div>
              <div className={styles.dishList}>
                {ungrouped.map(item => renderDishRow(item))}
              </div>
            </div>
          );
        })()}

        {/* ── Comment ── */}
        {order.comment && (
          <div className={styles.commentBox}>
            <span className={styles.commentLabel}>{t('clientComment', 'Коментар клієнта')}</span>
            <p className={styles.commentVal}>{order.comment}</p>
          </div>
        )}

        {/* ── Add items panel ── */}
        {addOpen && (
          <div className={styles.addPanel}>
            <div className={styles.addPanelHeader}>
              <span className={styles.addPanelTitle}>{t('addDishes', 'Додати страви')}</span>
              <button className={styles.closePanelBtn} onClick={() => setAddOpen(false)}><MdClose /></button>
            </div>
            <div className={styles.searchRow}>
              <MdSearch className={styles.searchIcon} />
              <input
                autoFocus
                className={styles.searchInput}
                placeholder={t('searchDish', 'Пошук страви…')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.menuList}>
              {filteredMenu.map(mi => (
                <div key={mi._id} className={styles.menuRow}>
                  <span className={styles.menuName}>{local(mi, 'name') || mi.name}</span>
                  <span className={styles.menuPrice}>{mi.basePrice}₴</span>
                  <div className={styles.qtyControl}>
                    <button className={styles.qtyBtn} onClick={() => setAddQtys(p => ({ ...p, [mi._id]: Math.max(0, (p[mi._id] || 0) - 1) }))}>−</button>
                    <span className={styles.qtyVal}>{addQtys[mi._id] || 0}</span>
                    <button className={styles.qtyBtn} onClick={() => setAddQtys(p => ({ ...p, [mi._id]: (p[mi._id] || 0) + 1 }))}>+</button>
                  </div>
                </div>
              ))}
              {filteredMenu.length === 0 && <p className={styles.noResults}>{t('noResults', 'Нічого не знайдено')}</p>}
            </div>
            <div className={styles.addPanelFooter}>
              <button
                className={styles.submitAddBtn}
                disabled={addSaving || !Object.values(addQtys).some(q => q > 0)}
                onClick={submitAdd}
              >
                {addSaving ? '…' : t('confirm', 'Додати')}
              </button>
              <button className={styles.cancelAddBtn} onClick={() => setAddOpen(false)}>
                {t('cancel', 'Скасувати')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dish edit modal ── */}
      {editingItem && (
        <DishEditModal
          orderId={id}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={!!deletingItemId}
        title={t('deleteItemConfirm')}
        confirmLabel={t('deleteYes')}
        cancelLabel={t('cancel')}
        onConfirm={() => confirmDelete(deletingItemId)}
        onCancel={() => setDeletingItemId(null)}
        danger
      />

      {/* ── Close order confirmation ── */}
      <ConfirmDialog
        open={closingOrder}
        title={order?.status === 'open_paid' ? t('completeOrderConfirm') : t('payCashConfirm')}
        confirmLabel={order?.status === 'open_paid' ? t('completeOrder') : t('payCash')}
        cancelLabel={t('cancel')}
        onConfirm={handleCloseOrder}
        onCancel={() => setClosingOrder(false)}
        danger={false}
      />

      {/* ── Revert payment confirmation ── */}
      <ConfirmDialog
        open={revertConfirm}
        title={t('revertPaymentConfirm')}
        confirmLabel={revertLoading ? '…' : t('revertPayment')}
        cancelLabel={t('cancel')}
        onConfirm={handleRevertPayment}
        onCancel={() => setRevertConfirm(false)}
        danger
      />
    </StaffShell>
  );
}
