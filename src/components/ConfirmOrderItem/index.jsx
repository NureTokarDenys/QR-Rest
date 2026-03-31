import React from 'react';
import styles from './confirmOrderItem.module.css';

export default function ConfirmOrderItem({ item }) {
  return (
    <div className={styles.row}>
      <span className={styles.qty}>{item.quantity}×</span>
      <span className={styles.name}>{item.name}</span>
      <span className={styles.price}>{item.price * item.quantity}₴</span>
    </div>
  );
}