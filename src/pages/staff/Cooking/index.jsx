import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import KanbanColumn from '../../../components/staff/KanbanColumn';
import { KANBAN_ITEMS } from '../../../data/mockData';
import styles from './cooking.module.css';

const STATUSES = ['waiting', 'cooking', 'ready', 'served'];

export default function Cooking() {
  const { t } = useTranslation('cooking');
  const [items, setItems] = useState(KANBAN_ITEMS);

  function handleStatusChange(itemId, newStatus) {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: newStatus } : it));
  }

  const totalDishes = items.length;

  return (
    <StaffShell
      title={`🍳 ${t('title')}`}
      rightActions={
        <div className={styles.headerExtra}>
          <span className={styles.count}>{totalDishes} {t('dishes')}</span>
          <button className={styles.filterBtn}>⊟ {t('filter')}</button>
        </div>
      }
    >
      <div className={styles.board}>
        {STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            items={items.filter(it => it.status === status)}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </StaffShell>
  );
}