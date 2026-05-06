import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStaffLayout } from '../../../context/StaffLayoutContext';
import styles from './rightPanel.module.css';

import { MdNotifications } from "react-icons/md";
import { MdShowChart } from "react-icons/md";

/**
 * Right panel — notifications and shift stats.
 * Live data for both sections is not yet provided by the API.
 * Both sections render an empty state until the backend is ready.
 */
export default function RightPanel() {
  const { panelOpen } = useStaffLayout();
  const { t } = useTranslation('tableMap');

  return (
    <div className={`${styles.panel} ${panelOpen ? styles.open : ''}`}>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>
          <MdNotifications className={styles.notificationIcon} />
          {t('notifications')}
        </p>
        <p style={{ fontSize: 13, color: 'var(--secondary-text)', padding: '4px 0' }}>—</p>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>
          <MdShowChart className={styles.chartIcon} /> {t('shiftStats')}
        </p>
        <p style={{ fontSize: 13, color: 'var(--secondary-text)', padding: '4px 0' }}>—</p>
      </div>
    </div>
  );
}
