import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import styles from './kanbanCard.module.css';

const NEXT_STATUS = { waiting: 'cooking', cooking: 'ready', ready: 'served' };
const BTN_COLORS  = { waiting: '#dc2626', cooking: '#d97706', ready: '#16a34a' };

export default function KanbanCard({ item, status, onStatusChange }) {
  const navigate = useNavigate();
  const local = useLocalField();
  const { t } = useTranslation('components');
  
  const next = NEXT_STATUS[status];

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    e.dataTransfer.setDragImage(e.currentTarget, offsetX, offsetY);

    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
  };

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={styles.card}
      style={item.orderColor ? { borderRightColor: item.orderColor } : {}}
      onClick={() => navigate(`/staff/order/${item.orderId}`)}
    >
      <div className={styles.top}>
        <span className={styles.dishName}>{local(item, 'dishName')}</span>
        <span className={styles.time}>{item.time}</span>
      </div>
      <div className={styles.meta}>
        <span className={styles.meta_tag}>{t('table_number')} {item.tableId}</span>
        <span className={styles.meta_tag}>#{item.orderId}</span>
        <span className={styles.meta_tag}>
          {item.dishCount} {t('dish', { count: item.dishCount })}
        </span>
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
          {t(`kanban_btn_${status}`)}
        </button>
      )}
    </div>
  );
}