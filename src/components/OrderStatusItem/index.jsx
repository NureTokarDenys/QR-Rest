import React from 'react';
import styles from './orderStatusItem.module.css';
import { useTranslation } from 'react-i18next';

import { MdHourglassTop } from "react-icons/md";
import { MdCheck } from "react-icons/md";
import { MdLocalFireDepartment } from "react-icons/md";

export default function OrderStatusItem({ name, status }) {
  const { t } = useTranslation('orderStatus');

  const statusConfig = {
    waiting: { label: <><MdHourglassTop /> {t('status_waiting')}</>, className: 'waiting' }, 
    cooking: { label: <><MdLocalFireDepartment /> {t('status_cooking')}</>, className: 'cooking' },
    ready: { label: <><MdCheck /> {t('status_ready')}</>, className: 'ready' },
    served: { label: <><MdCheck /> {t('status_served')}</>, className: 'served' },
  };

  const config = statusConfig[status] || statusConfig.waiting;

  return (
    <div className={styles.row}>
      <span className={styles.name}>{name}</span>
      <span className={`${styles.badge} ${styles[config.className]}`}>{config.label}</span>
    </div>
  );
}