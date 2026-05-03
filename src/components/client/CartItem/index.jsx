import React from 'react';
import { useApp } from '../../../context/AppContext';
import styles from './cartItem.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { MdDelete } from 'react-icons/md';

export default function CartItem({ item }) {
  const { updateQuantity, removeFromCart } = useApp();
  const local = useLocalField();

  const exclusions = item.excludedIngredients?.length > 0
    ? `−${item.excludedIngredients.join(', ')}`
    : null;

  return (
    <div className={styles.wrapper}>
      <img src={item.image} alt={item.name} className={styles.image} />
      <div className={styles.info}>
        <span className={styles.name}>{local(item, 'name')}</span>
        {exclusions && <span className={styles.exclusions}>{exclusions}</span>}
        {item.comment ? <span className={styles.comment}>💬 {item.comment}</span> : null}
        <span className={styles.price}>{item.price * item.quantity}₴</span>
        <div className={styles.controls}>
          <button className={styles.qtyBtn} onClick={() => updateQuantity(item.cartItemId, -1)}>−</button>
          <span className={styles.qty}>{item.quantity}</span>
          <button className={styles.qtyBtn} onClick={() => updateQuantity(item.cartItemId, 1)}>+</button>
          <button className={styles.deleteBtn} onClick={() => removeFromCart(item.cartItemId)}><MdDelete /></button>
        </div>
      </div>
    </div>
  );
}