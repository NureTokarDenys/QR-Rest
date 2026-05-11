import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './kanbanCard.module.css';

const NEXT_STATUS = { waiting: 'cooking', cooking: 'ready', ready: 'served' };
const BTN_COLORS  = { waiting: '#dc2626', cooking: '#d97706', ready: '#16a34a' };

function formatElapsed(isoTimestamp, now) {
  if (!isoTimestamp) return null;
  const ms = now - new Date(isoTimestamp).getTime();
  if (ms < 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  if (h > 0)      return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  if (totalMin > 0) return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  return `${s}s`;
}

export default function KanbanCard({ item: group, status, onStatusChange }) {
  const navigate = useNavigate();
  const { t } = useTranslation('components');

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = NEXT_STATUS[status];
  const blocked = next && !group.canAdvance;

  const createdElapsed      = formatElapsed(group.createdAt, now);
  const statusChangedElapsed = group.statusChangedAt
    ? formatElapsed(group.statusChangedAt, now)
    : null;

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', group.id);
    e.dataTransfer.effectAllowed = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    e.dataTransfer.setDragImage(e.currentTarget, e.clientX - rect.left, e.clientY - rect.top);
    setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
  };

  const handleDragEnd = (e) => { e.target.style.opacity = '1'; };

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={styles.card}
      style={group.orderColor ? { borderRightColor: group.orderColor } : {}}
      onClick={() => navigate(`/staff/order/${group.orderId}`)}
    >
      <div className={styles.top}>
        <span style={group.orderColor ? { background: group.orderColor } : {}} className={styles.groupBadge}>#{group.groupNumber}</span>
        {group.groupName ? <span className={styles.groupName}>{group.groupName}</span> : null}
        <div className={styles.meta}>
          <span className={styles.meta_tag}>{t('table_number')}{group.tableId}</span>
          <span className={styles.meta_tag}>#{group.orderId}</span>
        </div>
      </div>

      <div className={styles.items}>
        {(group.items || []).map(item => (
          <div key={item.id} className={styles.itemRow}>
            <span className={styles.itemQty}>×{item.quantity}</span>
            <span className={styles.itemName}>{item.name}</span>
            {item.categoryName && (
              <span
                className={styles.catTag}
                style={item.categoryColor ? {
                  background: `${item.categoryColor}20`,
                  color: item.categoryColor,
                } : undefined}
              >
                {item.categoryName}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Timers row — both always visible */}
      <div className={styles.timers}>
        <span className={styles.timerChip} title={t('timer_created_title')}>
          <span className={styles.timerIcon}>⏱</span>
          {createdElapsed ?? '—'}
        </span>
        <span className={`${styles.timerChip} ${styles.timerChipStatus}`} title={t('timer_status_title')}>
          <span className={styles.timerIcon}>⚡</span>
          {statusChangedElapsed ?? '—'}
        </span>
      </div>

      {group.hiddenBelow > 0 && (
        <div className={styles.stackIndicator}>
          +{group.hiddenBelow} {group.hiddenBelow === 1 ? t('more_group') : t('more_groups')}
        </div>
      )}

      {next && (
        <button
          className={`${styles.actionBtn} ${blocked ? styles.actionBtnBlocked : ''}`}
          style={blocked ? undefined : { background: BTN_COLORS[status] }}
          disabled={blocked}
          title={blocked ? t('blocked_by_group', { n: group.blockingGroupNumber }) : undefined}
          onClick={e => {
            e.stopPropagation();
            if (!blocked) onStatusChange && onStatusChange(group.id, next);
          }}
        >
          {blocked ? t('kanban_btn_blocked', { n: group.blockingGroupNumber }) : t(`kanban_btn_${status}`)}
        </button>
      )}
    </div>
  );
}
