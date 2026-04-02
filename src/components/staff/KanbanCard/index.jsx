import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './kanbanCard.module.css';

const NEXT_STATUS = { new: 'cooking', cooking: 'ready', ready: 'served' };
const BTN_LABELS  = { new: 'Прийняти', cooking: 'Готово', ready: 'Подати' };
const BTN_COLORS  = { new: '#dc2626', cooking: '#d97706', ready: '#16a34a' };

export default function KanbanCard({ item, status, onStatusChange }) {
  const navigate = useNavigate();
  const local = useLocalField();
  const next = NEXT_STATUS[status];

  return (
    <div
      className={styles.card}
      onClick={() => navigate(`/staff/order/${item.orderId}`)}
    >
      <div className={styles.top}>
        <span className={styles.dishName}>{local(item, 'dishName')}</span>
        <span className={styles.time}>{item.time}</span>
      </div>
      <div className={styles.meta}>
        <span className={styles.meta_tag}>Стіл #{item.tableId}</span>
        <span className={styles.meta_tag}>#{item.orderId}</span>
        <span className={styles.meta_tag}>{item.dishCount} страви</span>
      </div>
      {next && (
        <button
          className={styles.actionBtn}
          style={{ background: BTN_COLORS[status] }}
          onClick={e => {
            e.stopPropagation();
            onStatusChange && onStatusChange(item.id, next);
          }}
        >
          {BTN_LABELS[status]}
        </button>
      )}
    </div>
  );
}