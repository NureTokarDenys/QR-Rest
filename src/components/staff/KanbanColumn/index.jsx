import React from 'react';
import KanbanCard from '../KanbanCard';
import styles from './kanbanColumn.module.css';

const COLUMN_COLORS = {
  new:     { label: 'НОВІ',       bg: '#fef2f2', border: '#f87171', text: '#dc2626' },
  cooking: { label: 'ГОТУЮТЬСЯ',  bg: '#fff3e0', border: '#fbbf24', text: '#d97706' },
  ready:   { label: 'ГОТОВІ',     bg: '#f0fdf4', border: '#4ade80', text: '#16a34a' },
  served:  { label: 'ПОДАНІ',     bg: '#f0f9ff', border: '#7dd3fc', text: '#0369a1' },
};

export default function KanbanColumn({ status, items, onStatusChange }) {
  const cfg = COLUMN_COLORS[status];

  return (
    <div className={styles.column}>
      <div className={styles.header} style={{ color: cfg.text }}>
        <span className={styles.colLabel}>{cfg.label}</span>
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