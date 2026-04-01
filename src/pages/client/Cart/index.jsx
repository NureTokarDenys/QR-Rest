import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/Header';
import CartItem from '../../../components/CartItem';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/Footer';
import styles from './cart.module.css';

import { MdShoppingCart } from "react-icons/md";

export default function Cart() {
  const navigate = useNavigate();
  const { cart, cartTotal } = useApp();
  const [comment, setComment] = useState('');

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  function formatItems(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod100 >= 11 && mod100 <= 14) return `${count} позицій`;
    if (mod10 === 1)                   return `${count} позиція`;
    if (mod10 >= 2 && mod10 <= 4)      return `${count} позиції`;
    return `${count} позицій`;
  }

  return (
    <div className={styles.page}>
      <Header
        title="Кошик"
        showBack
        rightElement={<span className={styles.count}>{formatItems(totalItems)}</span>}
      />

      <div className={styles.content}>
        {cart.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><MdShoppingCart /></span>
            <p>Кошик порожній</p>
          </div>
        ) : (
          <>
            <div className={styles.items}>
              {cart.map(item => (
                <CartItem key={item.id} item={item} />
              ))}
            </div>

            <div className={styles.commentBox}>
              <p className={styles.commentLabel}>Коментар до замовлення</p>
              <textarea
                className={styles.textarea}
                placeholder="Побажання (алергени, подача...)"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <PrimaryButton
          label={`Оформити замовлення ${cartTotal}₴`}
          onClick={() => navigate('/confirm')}
          disabled={cart.length === 0}
        />
        <SecondaryButton
          label="Продовжити покупки"
          onClick={() => navigate('/menu')}
        />
      </div>

      <Footer />
    </div>
  );
}