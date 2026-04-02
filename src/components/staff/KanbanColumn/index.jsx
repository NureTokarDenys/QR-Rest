import React from 'react';
import { useTranslation } from 'react-i18next';
import KanbanCard from '../KanbanCard';
import styles from './kanbanColumn.module.css';

const COLUMN_COLORS = {
  waiting: { bg: '#fef2f2', border: '#f87171', text: '#dc2626' },
  cooking: { bg: '#fff3e0', border: '#fbbf24', text: '#d97706' },
  ready:   { bg: '#f0fdf4', border: '#4ade80', text: '#16a34a' },
  served:  { bg: '#f0f9ff', border: '#7dd3fc', text: '#0369a1' },
};

export default function KanbanColumn({ status, items, onStatusChange }) {
  const { t } = useTranslation('components');
  const cfg = COLUMN_COLORS[status] || COLUMN_COLORS.waiting;

  return (
    <div className={styles.column}>
      <div className={styles.header} style={{ color: cfg.text }}>
        <span className={styles.colLabel}>{t(`kanban_col_${status}`)}</span>
        <span className={styles.count}>{items.length}</span>
      </div>
      <div className={styles.cards}>
        {items.map(item => (
          <KanbanCard
            key={item.id}
            item={item}
            status={status}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
}