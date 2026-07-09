import React from 'react';
import styles from './confirmOrderItem.module.css';
import { useCartItemName } from '../../../hooks/useCartItemName';

export default function ConfirmOrderItem({ item }) {
  const displayName = useCartItemName(item);
  return (
    <div className={styles.row}>
      <span className={styles.qty}>{item.quantity}×</span>
      <span className={styles.name}>{displayName}</span>
      <span className={styles.price}>{item.price * item.quantity}₴</span>
    </div>
  );
}