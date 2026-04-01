import React from 'react';
import { useApp } from '../../context/AppContext';
import styles from './cartItem.module.css';
import { useLocalField } from '../../i18n/useLang';

import { MdDelete } from "react-icons/md";


export default function CartItem({ item }) {
  const { updateQuantity, removeFromCart } = useApp();

  const local = useLocalField();

  return (
    <div className={styles.wrapper}>
      <img src={item.image} alt={item.name} className={styles.image} />
      <div className={styles.info}>
        <span className={styles.name}>{local(item, 'name')}</span>
        <span className={styles.price}>{item.price * item.quantity}₴</span>
        <div className={styles.controls}>
          <button className={styles.qtyBtn} onClick={() => updateQuantity(item.id, -1)}>−</button>
          <span className={styles.qty}>{item.quantity}</span>
          <button className={styles.qtyBtn} onClick={() => updateQuantity(item.id, 1)}>+</button>
          <button className={styles.deleteBtn} onClick={() => removeFromCart(item.id)}><MdDelete /></button>
        </div>
      </div>
    </div>
  );
}