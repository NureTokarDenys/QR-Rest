import React from 'react';
import styles from './confirmOrderItem.module.css';
import { useLocalField } from '../../i18n/useLang';

export default function ConfirmOrderItem({ item }) {
  const local = useLocalField(); 
  return (
    <div className={styles.row}>
      <span className={styles.qty}>{item.quantity}×</span>
      <span className={styles.name}>{local(item, "name")}</span>
      <span className={styles.price}>{item.price * item.quantity}₴</span>
    </div>
  );
}