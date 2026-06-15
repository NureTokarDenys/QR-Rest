import React from 'react';
import { MdCheck } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import styles from './notificationItem.module.css';

const TYPE_CLASS = {
  ORDER_NEW:         'order',
  WAITER_CALL:       'waiter',
  WAITER_CALL_CASH:  'cash',
  ORDER_VOID:        'void',
  ORDER_CANCELLED:   'void',
  PAYMENT_COMPLETED: 'payment',
};

const CALL_TYPES = new Set(['WAITER_CALL', 'WAITER_CALL_CASH']);

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function NotificationItem({ notification, onMarkRead, onAcceptCall }) {
  const { t } = useTranslation('components');
  const typeClass = TYPE_CLASS[notification.type] ?? 'order';
  const isRead = !!notification.readAt;
  const isCall = CALL_TYPES.has(notification.type);

  function handleAccept(e) {
    e.stopPropagation();
    onAcceptCall?.(notification);
  }

  return (
    <div
      className={`${styles.item} ${styles[typeClass]} ${isRead ? styles.read : ''}`}
      onClick={() => !isRead && onMarkRead?.(notification.id)}
    >
      <div className={styles.itemTop}>
        {!isRead && <span className={styles.unreadDot} />}
        <div className={styles.body}>
          <span className={styles.text}>{notification.title}</span>
          <span className={styles.time}>{formatTime(notification.createdAt)}</span>
        </div>
      </div>
      {isCall && !isRead && onAcceptCall && (
        <button className={styles.acceptBtn} onClick={handleAccept}>
          <MdCheck size={13} />
          {t('acceptCall')}
        </button>
      )}
    </div>
  );
}
