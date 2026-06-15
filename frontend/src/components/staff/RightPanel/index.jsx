import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStaffLayout } from '../../../context/StaffLayoutContext';
import { useStaffNotifications } from '../../../context/StaffNotificationsContext';
import { resolveWaiterCall } from '../../../api/orders';
import NotificationItem from '../NotificationItem';
import styles from './rightPanel.module.css';
import { MdNotifications, MdDoneAll, MdDeleteSweep } from 'react-icons/md';

export default function RightPanel() {
  const { panelOpen } = useStaffLayout();
  const { t } = useTranslation('components');
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useStaffNotifications();
  const navigate = useNavigate();

  async function handleAcceptCall(notification) {
    markRead(notification.id);
    if (notification.callId) {
      try { await resolveWaiterCall(notification.callId); } catch { /* navigate anyway */ }
    }
    navigate(`/staff/table/${notification.tableNum}`);
  }

  return (
    <div className={`${styles.panel} ${panelOpen ? styles.open : ''}`}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>
            <MdNotifications className={styles.notificationIcon} />
            {t('nav_orders')}
            {unreadCount > 0 && <span className={styles.count}>{unreadCount}</span>}
          </p>
          {notifications.length > 0 && (
            <div className={styles.headerActions}>
              {unreadCount > 0 && (
                <button className={styles.actionBtn} onClick={markAllRead} title={t('notif_mark_all_read')}>
                  <MdDoneAll />
                </button>
              )}
              <button className={styles.actionBtn} onClick={clearAll} title={t('notif_clear_all')}>
                <MdDeleteSweep />
              </button>
            </div>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className={styles.empty}>{t('notif_empty')}</p>
        ) : (
          <div className={styles.list}>
            {notifications.map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={markRead}
                onAcceptCall={handleAcceptCall}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
