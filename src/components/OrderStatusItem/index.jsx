import React from 'react';
import styles from './orderStatusItem.module.css';

import { MdHourglassTop } from "react-icons/md";
import { MdCheck } from "react-icons/md";
import { MdLocalFireDepartment } from "react-icons/md";

const statusConfig = {
  waiting: { label: <><MdHourglassTop /> Очікує</>, className: 'waiting' }, 
  cooking: { label: <><MdLocalFireDepartment /> Готується</>, className: 'cooking' },
  ready: { label: <><MdCheck /> Готово</>, className: 'ready' },
};

export default function OrderStatusItem({ name, status }) {
  const config = statusConfig[status] || statusConfig.waiting;

  return (
    <div className={styles.row}>
      <span className={styles.name}>{name}</span>
      <span className={`${styles.badge} ${styles[config.className]}`}>{config.label}</span>
    </div>
  );
}