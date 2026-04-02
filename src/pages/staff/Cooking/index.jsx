import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import KanbanColumn from '../../../components/staff/KanbanColumn';
import { KANBAN_ITEMS } from '../../../data/mockData';
import styles from './cooking.module.css';

import { MdLocalFireDepartment } from "react-icons/md";

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

export default function Cooking() {
  const { t } = useTranslation('components');
  const [items, setItems] = useState(KANBAN_ITEMS);

  function handleStatusChange(itemId, newStatus) {
    setItems(prev => prev.map(it => 
      String(it.id) === String(itemId) ? { ...it, status: newStatus } : it
    ));
  }

  const enrichedItems = useMemo(() => {
    return items.map(item => ({
      ...item,
      orderColor: getOrderColor(item.orderId)
    }));
  }, [items]);

  const totalDishes = items.length;

  return (
    <StaffShell
      title={<><MdLocalFireDepartment /> {t('nav_cooking')}</>}
      rightActions={
        <div className={styles.headerExtra}>
          <span className={styles.count}>{totalDishes} {t('dish', { count: totalDishes })}</span>
          <button className={styles.filterBtn}>⊟ {t('filter', 'Фільтр')}</button>
        </div>
      }
    >
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
    </StaffShell>
  );
}