import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './notificationItem.module.css';

export default function NotificationItem({ notification }) {
  const { t } = useTranslation('components');
  const isWaiter = notification.type === 'waiter';

  return (
    <div className={`${styles.item} ${isWaiter ? styles.waiter : styles.order}`}>
      <div className={styles.top}>
        <span className={styles.text}>
          {isWaiter
            ? `${t('table_number')} ${notification.tableId} ${t('waiterCalled')}`
            : `${t('newOrder')} — ${t('table_number')} ${notification.tableId}`}
        </span>
        <span className={styles.time}>{notification.time}</span>
      </div>
      <button className={`${styles.accept} ${isWaiter ? styles.waiter_btn : styles.order_btn}`}>
        {t('accept')}
      </button>
    </div>
  );
}