import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import KanbanColumn from '../../../components/staff/KanbanColumn';
import { getKitchenOrders, updateItemStatus } from '../../../api/kitchen';
import styles from './cooking.module.css';

import { MdLocalFireDepartment, MdViewColumn, MdTableChart } from 'react-icons/md';

const STATUSES = ['waiting', 'cooking', 'ready', 'served'];

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

function flattenOrders(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return null;
  return orders.flatMap(order => {
    const orderId = order._id || order.id;
    const tableNum = order.table?.number ?? order.tableNumber ?? order.tableId ?? 0;
    return (order.items || []).map(item => ({
      id: item._id || item.id,
      orderId,
      tableId: tableNum,
      dishName: (typeof item.menuItemId === 'object' ? item.menuItemId?.name : null) || item.name || item.dishName || '—',
      status: item.dishStatus || item.status || 'waiting',
    }));
  });
}

export default function Cooking() {
  const { t } = useTranslation('cooking');
  const { t: tc } = useTranslation('components');
  const [items, setItems] = useState([]);
  const [view, setView] = useState('order'); // 'order' | 'table'
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await getKitchenOrders('order');
      const flattened = flattenOrders(data);
      if (flattened !== null) setItems(flattened);
    } catch (err) {
      console.error('getKitchenOrders error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function handleStatusChange(itemId, newStatus) {
    // Optimistic update
    setItems(prev => prev.map(it =>
      String(it.id) === String(itemId) ? { ...it, status: newStatus } : it
    ));
    // Find orderId for this item
    const item = items.find(it => String(it.id) === String(itemId));
    if (item?.orderId) {
      try {
        await updateItemStatus(item.orderId, itemId, newStatus);
      } catch (err) {
        console.error('updateItemStatus error:', err);
        // Revert on failure
        fetchOrders();
      }
    }
  }

  function handleTableGroupReady(tableId) {
    items
      .filter(it => it.tableId === tableId && it.status !== 'served')
      .forEach(it => {
        const next = STATUSES[Math.min(STATUSES.indexOf(it.status) + 1, STATUSES.length - 1)];
        handleStatusChange(it.id, next);
      });
  }

  const enrichedItems = useMemo(() => items.map(item => ({
    ...item,
    orderColor: getOrderColor(item.orderId)
  })), [items]);

  const totalDishes = items.filter(it => it.status !== 'served').length;

  const tableGroups = useMemo(() => {
    const byTable = {};
    enrichedItems.forEach(item => {
      if (!byTable[item.tableId]) byTable[item.tableId] = [];
      byTable[item.tableId].push(item);
    });
    return Object.entries(byTable)
      .filter(([, its]) => its.some(it => it.status !== 'served'))
      .map(([tableId, its]) => ({ tableId: Number(tableId), items: its }));
  }, [enrichedItems]);

  return (
    <StaffShell
      title={<><MdLocalFireDepartment /> {t('title')}</>}
      rightActions={
        <div className={styles.headerExtra}>
          <span className={styles.count}>{totalDishes} {tc('dish', { count: totalDishes })}</span>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'order' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('order')}
              title={t('order_view')}
            >
              <MdViewColumn /> {t('order_view')}
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('table')}
              title={t('table_view')}
            >
              <MdTableChart /> {t('table_view')}
            </button>
          </div>
        </div>
      }
    >
      {view === 'order' ? (
        <div className={styles.board}>
          {STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              items={enrichedItems.filter(it => it.status === status)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className={styles.tableView}>
          {tableGroups.length === 0 ? (
            <p className={styles.noItems}>{t('noItems')}</p>
          ) : tableGroups.map(({ tableId, items: tItems }) => {
            const pending = tItems.filter(it => it.status !== 'served');
            const allReady = pending.every(it => it.status === 'ready');
            return (
              <div key={tableId} className={styles.tableCard}>
                <div className={styles.tableCardHeader}>
                  <span className={styles.tableCardTitle}>{t('table')} {tableId}</span>
                  <span className={styles.tableCardMeta}>{pending.length} {tc('dish', { count: pending.length })}</span>
                  <button
                    className={`${styles.tableReadyBtn} ${allReady ? styles.tableReadyBtnHighlight : ''}`}
                    onClick={() => handleTableGroupReady(tableId)}
                  >
                    {t('mark_ready')}
                  </button>
                </div>
                <div className={styles.tableCardItems}>
                  {tItems.map(item => (
                    <div key={item.id} className={styles.tableItemRow}>
                      <span
                        className={styles.tableItemDot}
                        style={{ background: item.orderColor }}
                      />
                      <span className={styles.tableItemName}>{item.dishName}</span>
                      <span className={`${styles.tableItemStatus} ${styles[`status_${item.status}`]}`}>
                        {t(item.status)}
                      </span>
                      {item.status !== 'served' && (
                        <button
                          className={styles.tableItemBtn}
                          onClick={() => handleStatusChange(item.id, STATUSES[Math.min(STATUSES.indexOf(item.status) + 1, STATUSES.length - 1)])}
                        >
                          →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StaffShell>
  );
}
