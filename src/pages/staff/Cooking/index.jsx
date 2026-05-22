import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import KanbanColumn, { KanbanColumnSkeleton } from '../../../components/staff/KanbanColumn';
import WsStatusBanner from '../../../components/WsStatusBanner';
import { updateGroupStatus } from '../../../api/kitchen';
import { useStaffData } from '../../../context/StaffDataContext';
import { useWebSocket } from '../../../hooks/useWebSocket';
import styles from './cooking.module.css';

import { MdLocalFireDepartment, MdViewColumn, MdTableChart } from 'react-icons/md';

function nameOf(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj.name || obj.name_en || '';
}
function getExcluded(item) {
  return (item.excludedIngredients || []).map(x => nameOf(x)).filter(Boolean);
}
function getAddons(item) {
  return (item.addons || []).map(ao => {
    const base = nameOf(typeof ao.addonId === 'object' ? ao.addonId : ao) || nameOf(ao.addon);
    if (!base) return null;
    return ao.quantity > 1 ? `${base} ×${ao.quantity}` : base;
  }).filter(Boolean);
}
function getChoices(item) {
  return (item.componentGroupChoices || []).map(c => {
    const grp = nameOf(typeof c.groupId === 'object' ? c.groupId : null) || c.groupName || '';
    const opt = nameOf(typeof c.optionId === 'object' ? c.optionId : null) || c.optionName || '';
    if (grp && opt) return `${grp}: ${opt}`;
    return opt || grp || null;
  }).filter(Boolean);
}

function formatElapsed(isoTimestamp, now) {
  if (!isoTimestamp) return null;
  const ms = now - new Date(isoTimestamp).getTime();
  if (ms < 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  if (h > 0)        return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  if (totalMin > 0) return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  return `${s}s`;
}

const STATUSES = ['waiting', 'cooking', 'ready', 'served'];
const STATUS_LEVEL = { waiting: 0, cooking: 1, ready: 2, served: 3 };
const ROLLBACK_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

const ORDER_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#881337', '#1e3a8a', '#14532d'
];

const getOrderColor = (orderId) => {
  if (!orderId) return 'transparent';
  const hash = String(orderId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ORDER_COLORS[hash % ORDER_COLORS.length];
};

function getGroupStatus(items) {
  if (!items.length) return 'waiting';
  const minLevel = Math.min(...items.map(i => STATUS_LEVEL[i.dishStatus] ?? 0));
  return STATUSES[minLevel] ?? 'waiting';
}

function buildGroupCards(orders) {
  const cards = [];
  for (const order of orders) {
    const orderId = String(order._id || order.id);
    const orderColor = getOrderColor(orderId);
    const tableNum = order.table?.number ?? order.tableNumber ?? order.tableId ?? 0;

    const sortedGroups = [...(order.servingGroups || [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );

    if (sortedGroups.length === 0 && (order.items || []).length > 0) {
      const groupStatus = getGroupStatus(order.items);
      // Served groups stay visible — they only disappear when the order closes
      // (completed_cash / completed_epay / cancelled), which the backend filter
      // already removes from this list.
      cards.push({
        id: `${orderId}_ungrouped`,
        groupId: null,
        orderId,
        groupNumber: 1,
        groupName: '',
        tableId: tableNum,
        orderColor,
        status: groupStatus,
        canAdvance: groupStatus !== 'served',
        blockingGroupNumber: null,
        createdAt: order.createdAt || null,
        statusChangedAt: null,
        items: (order.items || []).map(item => ({
          id: String(item._id),
          name: (typeof item.menuItemId === 'object' ? item.menuItemId?.name : null) || item.name || '—',
          quantity: item.quantity || 1,
          categoryName:  item.categoryName  || null,
          categoryColor: item.categoryColor || null,
          excludedIngredients:    item.excludedIngredients    || [],
          addons:                 item.addons                 || [],
          componentGroupChoices:  item.componentGroupChoices  || [],
          comment:                item.comment                || null,
        })),
        hiddenBelow: 0,
      });
      continue;
    }

    const groupStatuses = sortedGroups.map(g => {
      const gItems = (order.items || []).filter(
        item => item.servingGroupId && String(item.servingGroupId) === String(g._id)
      );
      return getGroupStatus(gItems);
    });

    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i];
      const groupId = String(group._id);
      const groupItems = (order.items || []).filter(
        item => item.servingGroupId && String(item.servingGroupId) === groupId
      );

      if (groupItems.length === 0) continue;

      const groupStatus = groupStatuses[i];
      // Served groups remain in the "served" column until the parent order
      // closes (the backend filter already excludes completed_* / cancelled).

      if (groupStatus === 'waiting') {
        const precedingAllStarted = groupStatuses.slice(0, i).every((s, k) => {
          const pgItems = (order.items || []).filter(
            item => item.servingGroupId && String(item.servingGroupId) === String(sortedGroups[k]._id)
          );
          return !pgItems.length || s !== 'waiting';
        });
        if (!precedingAllStarted) continue;
      }

      const nextStatus = STATUSES[STATUSES.indexOf(groupStatus) + 1];
      let canAdvance = Boolean(nextStatus);
      let blockingGroupNumber = null;
      if (canAdvance && nextStatus && i > 0) {
        for (let k = 0; k < i; k++) {
          const pgItems = (order.items || []).filter(
            item => item.servingGroupId && String(item.servingGroupId) === String(sortedGroups[k]._id)
          );
          if (!pgItems.length) continue;
          if ((STATUS_LEVEL[groupStatuses[k]] ?? 0) < (STATUS_LEVEL[nextStatus] ?? 0)) {
            canAdvance = false;
            blockingGroupNumber = k + 1;
            break;
          }
        }
      }

      let hiddenBelow = 0;
      if (groupStatus === 'waiting') {
        for (let j = i + 1; j < sortedGroups.length; j++) {
          if (groupStatuses[j] === 'waiting') hiddenBelow++;
        }
      }

      cards.push({
        id: groupId,
        groupId,
        orderId,
        groupNumber: i + 1,
        groupName: group.name || '',
        tableId: tableNum,
        orderColor,
        status: groupStatus,
        canAdvance,
        blockingGroupNumber,
        createdAt: group.createdAt || null,
        statusChangedAt: group.statusChangedAt || null,
        wasRolledBack: group.wasRolledBack || false,
        items: groupItems.map(item => ({
          id: String(item._id),
          name: (typeof item.menuItemId === 'object' ? item.menuItemId?.name : null) || item.name || '—',
          quantity: item.quantity || 1,
          categoryName:  item.categoryName  || null,
          categoryColor: item.categoryColor || null,
          excludedIngredients:   item.excludedIngredients   || [],
          addons:                item.addons                || [],
          componentGroupChoices: item.componentGroupChoices || [],
          comment:               item.comment               || null,
        })),
        hiddenBelow,
      });
    }
  }
  return cards;
}

function applyGroupUpdate(orders, orderId, groupId, newStatus, wasRolledBack = false) {
  const now = new Date().toISOString();
  return orders.map(order => {
    if (String(order._id || order.id) !== String(orderId)) return order;
    return {
      ...order,
      items: (order.items || []).map(item => {
        if (!item.servingGroupId || String(item.servingGroupId) !== groupId) return item;
        return { ...item, dishStatus: newStatus };
      }),
      servingGroups: (order.servingGroups || []).map(g =>
        String(g._id) === groupId ? { ...g, statusChangedAt: now, wasRolledBack } : g
      ),
    };
  });
}

// Apply an incoming DISH_STATUS_UPDATED event in-place
function applyDishStatusUpdate(orders, orderId, orderItemId, dishStatus) {
  return orders.map(order => {
    if (String(order._id || order.id) !== String(orderId)) return order;
    return {
      ...order,
      items: (order.items || []).map(item =>
        String(item._id) === String(orderItemId) ? { ...item, dishStatus } : item
      ),
    };
  });
}

// Apply an incoming GROUP_STATUS_UPDATED event — set all items in the group
function applyGroupStatusEvent(orders, orderId, groupId, status) {
  return orders.map(order => {
    if (String(order._id || order.id) !== String(orderId)) return order;
    return {
      ...order,
      items: (order.items || []).map(item =>
        item.servingGroupId && String(item.servingGroupId) === String(groupId)
          ? { ...item, dishStatus: status }
          : item
      ),
    };
  });
}

export default function Cooking() {
  const { t } = useTranslation('cooking');
  const { t: tc } = useTranslation('components');

  // Kitchen orders live in the shared cache — lazy-loaded on first visit,
  // kept fresh via WS. In-place status flips happen without a refetch.
  const { kitchenOrders, setKitchenOrders, refreshKitchenOrders, ensureKitchenOrders } = useStaffData();
  useEffect(() => { ensureKitchenOrders(); }, [ensureKitchenOrders]);
  const orders  = Array.isArray(kitchenOrders) ? kitchenOrders : [];
  const loading = kitchenOrders === null;
  const setOrders = setKitchenOrders;

  const [view, setView] = useState('order');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  // ORDER_NEW / ORDER_UPDATED / ORDER_*_CANCELLED are handled by the cache layer.
  // We only need to apply in-place DISH/GROUP status updates so column moves
  // happen without a full refetch.
  const handleWsMessage = useCallback((msg) => {
    const { event, payload } = msg;
    if (!payload) return;

    if (event === 'DISH_STATUS_UPDATED') {
      setOrders(prev => applyDishStatusUpdate(prev || [], payload.orderId, payload.orderItemId, payload.dishStatus));
      return;
    }
    if (event === 'GROUP_STATUS_UPDATED') {
      setOrders(prev => applyGroupStatusEvent(prev || [], payload.orderId, payload.groupId, payload.status));
    }
  }, [setOrders]);

  const { status: wsStatus } = useWebSocket({ onMessage: handleWsMessage });

  const groupCards = useMemo(() => buildGroupCards(orders), [orders]);

  // Count ALL dishes that haven't been served yet, including hidden stacked groups
  const activeCount = useMemo(() => {
    let count = 0;
    for (const order of orders) {
      for (const item of (order.items || [])) {
        if ((item.dishStatus || 'waiting') !== 'served') count++;
      }
    }
    return count;
  }, [orders]);

  async function doStatusChange(card, newStatus, isRollback = false) {
    if (!card.groupId) return;
    setOrders(prev => applyGroupUpdate(prev || [], card.orderId, card.groupId, newStatus, isRollback));
    try {
      await updateGroupStatus(card.orderId, card.groupId, newStatus);
    } catch (err) {
      console.error('updateGroupStatus error:', err);
      refreshKitchenOrders();
    }
  }

  function handleGroupStatusChange(groupId, newStatus) {
    const card = groupCards.find(g => g.id === groupId);
    if (!card || !card.groupId) return;

    const isBackward = (STATUS_LEVEL[newStatus] ?? 0) < (STATUS_LEVEL[card.status] ?? 0);
    const isForward  = (STATUS_LEVEL[newStatus] ?? 0) > (STATUS_LEVEL[card.status] ?? 0);

    if (isBackward) {
      // Only one step back at a time (e.g. cooking → waiting, not ready → waiting)
      if ((STATUS_LEVEL[card.status] ?? 0) - (STATUS_LEVEL[newStatus] ?? 0) > 1) return;

      const secsElapsed = card.statusChangedAt
        ? Math.floor((Date.now() - new Date(card.statusChangedAt).getTime()) / 1000)
        : Infinity;
      const windowSecs   = Math.floor(ROLLBACK_WINDOW_MS / 1000);
      const withinWindow = secsElapsed <= windowSecs;
      const deadline     = card.statusChangedAt
        ? new Date(card.statusChangedAt).getTime() + ROLLBACK_WINDOW_MS
        : 0;

      if (!withinWindow) {
        setConfirmDialog({ card, newStatus, blocked: true, blockedReason: 'rollback_window_expired' });
        return;
      }
      if (card.wasRolledBack) {
        setConfirmDialog({ card, newStatus, blocked: true, blockedReason: 'rollback_already_used' });
        return;
      }
      setConfirmDialog({ card, newStatus, blocked: false, deadline });
      return;
    }
    if (isForward && !card.canAdvance) return;
    if (isForward) doStatusChange(card, newStatus, false);
  }

  function confirmBackward() {
    if (!confirmDialog || confirmDialog.blocked) return;
    doStatusChange(confirmDialog.card, confirmDialog.newStatus, true);
    setConfirmDialog(null);
  }

  // ── Table view ──────────────────────────────────────────────────────────────
  const tableGroups = useMemo(() => {
    const byTable = {};
    for (const order of orders) {
      const tableNum = order.table?.number ?? order.tableNumber ?? order.tableId ?? 0;
      const key = String(tableNum);
      if (!byTable[key]) byTable[key] = { tableId: key, tableNum, orders: [] };

      const orderId = String(order._id || order.id);
      const orderColor = getOrderColor(orderId);
      const sortedGroups = [...(order.servingGroups || [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );

      const groupStatuses = sortedGroups.map(g => {
        const gItems = (order.items || []).filter(
          item => item.servingGroupId && String(item.servingGroupId) === String(g._id)
        );
        return getGroupStatus(gItems);
      });

      const groups = sortedGroups.map((group, i) => {
        const groupId = String(group._id);
        const items = (order.items || []).filter(
          item => item.servingGroupId && String(item.servingGroupId) === groupId
        );
        const groupStatus = groupStatuses[i];

        const nextStatus = STATUSES[STATUSES.indexOf(groupStatus) + 1];
        let canAdvance = Boolean(nextStatus);
        if (canAdvance && i > 0) {
          canAdvance = groupStatuses.slice(0, i).every((s, k) => {
            const pgItems = (order.items || []).filter(
              item => item.servingGroupId && String(item.servingGroupId) === String(sortedGroups[k]._id)
            );
            return !pgItems.length || (STATUS_LEVEL[s] ?? 0) >= (STATUS_LEVEL[nextStatus] ?? 0);
          });
        }

        return {
          groupId,
          groupNumber: i + 1,
          groupName: group.name || '',
          status: groupStatus,
          canAdvance,
          orderColor,
          orderId,
          createdAt: group.createdAt || null,
          statusChangedAt: group.statusChangedAt || null,
          items: items.map(item => ({
            id: String(item._id),
            name: (typeof item.menuItemId === 'object' ? item.menuItemId?.name : null) || item.name || '—',
            quantity: item.quantity || 1,
            categoryName:  item.categoryName  || null,
            categoryColor: item.categoryColor || null,
            excludedIngredients:   item.excludedIngredients   || [],
            addons:                item.addons                || [],
            componentGroupChoices: item.componentGroupChoices || [],
            comment:               item.comment               || null,
          })),
        };
      }).filter(g => g.status !== 'served' && g.items.length > 0);

      if (groups.length > 0) {
        byTable[key].orders.push({ orderId, orderColor, groups });
      }
    }
    return Object.values(byTable).filter(t => t.orders.length > 0);
  }, [orders]);

  function handleTableGroupBtn(group) {
    const next = STATUSES[STATUSES.indexOf(group.status) + 1];
    if (!next || !group.canAdvance) return;
    const card = groupCards.find(g => g.id === group.groupId);
    if (card) {
      doStatusChange(card, next);
    } else {
      setOrders(prev => applyGroupUpdate(prev || [], group.orderId, group.groupId, next));
      updateGroupStatus(group.orderId, group.groupId, next).catch(() => refreshKitchenOrders());
    }
  }

  if (loading) {
    // Per-column card variety mimicking the real kanban load shown in the reference
    const SKELETON_BY_STATUS = {
      waiting: [
        { withAction: true,  items: 2, withMods: true },
        { withAction: true,  items: 2, withMods: true },
      ],
      cooking: [
        { withAction: true,  items: 2, withMods: true },
        { withAction: true,  items: 3, withMods: true },
      ],
      ready: [
        { withAction: true,  items: 2, withMods: true },
        { withAction: true,  items: 2, withMods: false },
      ],
      served: [
        { withAction: false, items: 2, withMods: true },
      ],
    };
    return (
      <StaffShell title={<><MdLocalFireDepartment /> {t('title')}</>}>
        <div className={styles.board}>
          {STATUSES.map(status => (
            <KanbanColumnSkeleton
              key={status}
              status={status}
              cards={SKELETON_BY_STATUS[status]}
            />
          ))}
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell
      title={<><MdLocalFireDepartment /> {t('title')}</>}
      rightActions={
        <div className={styles.headerExtra}>
          <span className={styles.count}>{activeCount} {tc('dish', { count: activeCount })}</span>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'order' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('order')}
            >
              <MdViewColumn /> {t('order_view')}
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('table')}
            >
              <MdTableChart /> {t('table_view')}
            </button>
          </div>
        </div>
      }
    >
      <WsStatusBanner status={wsStatus} />

      {view === 'order' ? (
        <div className={styles.board}>
          {STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              items={groupCards.filter(g => g.status === status)}
              onStatusChange={handleGroupStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className={styles.tableView}>
          {tableGroups.length === 0 ? (
            <p className={styles.noItems}>{t('noItems')}</p>
          ) : tableGroups.map(({ tableId, tableNum, orders: tOrders }) => (
            <div key={tableId} className={styles.tableCard}>
              <div className={styles.tableCardHeader}>
                <span className={styles.tableCardTitle}>{t('table')} {tableNum}</span>
              </div>
              {tOrders.map(({ orderId, orderColor, groups }) => (
                <div key={orderId} className={styles.orderBlock}>
                  <div className={styles.orderBlockHeader} style={{ borderLeftColor: orderColor }}>
                    <span className={styles.orderBlockId}>#{orderId}</span>
                  </div>
                  {groups.map(group => (
                    <div key={group.groupId} className={styles.groupBlock}>
                      <div className={styles.groupBlockHeader}>
                        <span className={styles.groupBadge}>{group.groupNumber}</span>
                        {group.groupName ? <span className={styles.groupBlockName}>{group.groupName}</span> : null}
                        <span className={`${styles.tableItemStatus} ${styles[`status_${group.status}`]}`}>
                          {tc(`status_${group.status}`)}
                        </span>
                        <div className={styles.groupTimers}>
                          <span className={styles.groupTimerChip} title={tc('timer_created_title')}>
                            <em className={styles.groupTimerIcon}>⏱</em>
                            {formatElapsed(group.createdAt, now) ?? '—'}
                          </span>
                          <span className={`${styles.groupTimerChip} ${styles.groupTimerChipStatus}`} title={tc('timer_status_title')}>
                            <em className={styles.groupTimerIcon}>⚡</em>
                            {formatElapsed(group.statusChangedAt, now) ?? '—'}
                          </span>
                        </div>
                        {group.status !== 'served' && (
                          <button
                            className={styles.tableItemBtn}
                            disabled={!group.canAdvance}
                            title={!group.canAdvance ? t('blocked_advance') : undefined}
                            onClick={() => handleTableGroupBtn(group)}
                          >
                            →
                          </button>
                        )}
                      </div>
                      {group.items.map(item => {
                        const excluded = getExcluded(item);
                        const addons   = getAddons(item);
                        const choices  = getChoices(item);
                        return (
                          <div key={item.id} className={styles.tableItemRow}>
                            <span className={styles.tableItemDot} style={{ background: orderColor }} />
                            <span className={styles.tableItemQty}>×{item.quantity}</span>
                            <div className={styles.tableItemContent}>
                              <div className={styles.tableItemNameRow}>
                                <span className={styles.tableItemName}>{item.name}</span>
                                {item.categoryName && (
                                  <span
                                    className={styles.tableCatTag}
                                    style={item.categoryColor ? {
                                      background: `${item.categoryColor}20`,
                                      color: item.categoryColor,
                                    } : undefined}
                                  >
                                    {item.categoryName}
                                  </span>
                                )}
                              </div>
                              {excluded.length > 0 && (
                                <div className={styles.tableItemMods}>
                                  {excluded.map((name, i) => (
                                    <span key={i} className={styles.tableExcludedTag}>−{name}</span>
                                  ))}
                                </div>
                              )}
                              {addons.length > 0 && (
                                <div className={styles.tableItemMods}>
                                  {addons.map((label, i) => (
                                    <span key={i} className={styles.tableAddonTag}>+{label}</span>
                                  ))}
                                </div>
                              )}
                              {choices.length > 0 && (
                                <div className={styles.tableItemMods}>
                                  {choices.map((label, i) => (
                                    <span key={i} className={styles.tableChoiceTag}>{label}</span>
                                  ))}
                                </div>
                              )}
                              {item.comment && (
                                <p className={styles.tableItemComment}>«{item.comment}»</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {confirmDialog && (() => {
        // Derive live countdown from the already-ticking `now` state
        const secsLeft = confirmDialog.blocked
          ? 0
          : Math.max(0, Math.floor((confirmDialog.deadline - now) / 1000));

        // Auto-dismiss when window expires while dialog is open
        if (!confirmDialog.blocked && secsLeft === 0) {
          setTimeout(() => setConfirmDialog(d =>
            d && !d.blocked ? { ...d, blocked: true, blockedReason: 'rollback_window_expired' } : d
          ), 0);
        }

        return (
          <div className={styles.overlay} onClick={() => setConfirmDialog(null)}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
              {confirmDialog.blocked ? (
                <>
                  <p className={styles.dialogTitle}>{t('rollback_blocked_title')}</p>
                  <p className={styles.dialogSub}>{t(confirmDialog.blockedReason)}</p>
                  <div className={styles.dialogActions}>
                    <button className={styles.dialogCancel} onClick={() => setConfirmDialog(null)}>
                      {t('close')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.dialogTitle}>{t('confirm_backward_title')}</p>
                  <p className={styles.dialogSub}>
                    {t('confirm_backward_sub', {
                      from: tc(`status_${confirmDialog.card.status}`),
                      to:   tc(`status_${confirmDialog.newStatus}`),
                    })}
                  </p>
                  <p className={styles.dialogWindowHint}>
                    {t('rollback_window_remaining', { secs: secsLeft })}
                  </p>
                  <p className={styles.dialogCorrectionNote}>
                    {t('rollback_client_notified')}
                  </p>
                  <div className={styles.dialogActions}>
                    <button className={styles.dialogCancel} onClick={() => setConfirmDialog(null)}>
                      {t('cancel')}
                    </button>
                    <button className={styles.dialogConfirm} onClick={confirmBackward}>
                      {t('confirm')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </StaffShell>
  );
}
