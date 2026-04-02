import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffLayout } from '../../../context/StaffLayoutContext';
import NotificationItem from '../NotificationItem';
import ShiftStats from '../ShiftStats';
import { NOTIFICATIONS, SHIFT_STATS } from '../../../data/mockData';
import styles from './rightPanel.module.css';

export default function RightPanel() {
  const { panelOpen } = useStaffLayout();
  const { t } = useTranslation('tableMap');

  return (
    <div className={`${styles.panel} ${panelOpen ? styles.open : ''}`}>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>
          🔔 {t('notifications')}
          {NOTIFICATIONS.length > 0 && (
            <span className={styles.count}>{NOTIFICATIONS.length}</span>
          )}
        </p>
        {NOTIFICATIONS.map(n => (
          <NotificationItem key={n.id} notification={n} />
        ))}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>📈 {t('shiftStats')}</p>
        <ShiftStats stats={SHIFT_STATS} />
      </div>
    </div>
  );
}