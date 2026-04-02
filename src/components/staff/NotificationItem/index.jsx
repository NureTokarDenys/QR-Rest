import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './notificationItem.module.css';

export default function NotificationItem({ notification }) {
  const { t } = useTranslation('tableMap');
  const isWaiter = notification.type === 'waiter';

  return (
    <div className={`${styles.item} ${isWaiter ? styles.waiter : styles.order}`}>
      <div className={styles.top}>
        <span className={styles.text}>
          {isWaiter
            ? `${t('tableMap:title').split(' ')[1] || 'Стіл'} #${notification.tableId} ${t('waiterCalled')}`
            : `${t('newOrder')} — Стіл #${notification.tableId}`}
        </span>
        <span className={styles.time}>{notification.time}</span>
      </div>
      <button className={styles.accept}>{t('accept')}</button>
    </div>
  );
}