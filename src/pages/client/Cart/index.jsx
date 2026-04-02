import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/client/Header';
import CartItem from '../../../components/client/CartItem';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/client/Footer';
import styles from './cart.module.css';
import { useTranslation } from 'react-i18next';

import { MdShoppingCart } from "react-icons/md";

export default function Cart() {
  const { t } = useTranslation('cart');
  const navigate = useNavigate();
  const { cart, cartTotal, orderComment, setOrderComment } = useApp();

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className={styles.page}>
      <Header
        title={t('cart_header')}
        showBack
        rightElement={<span className={styles.count}>{totalItems} {t('position', { count: totalItems })}</span>}
      />

      <div className={styles.content}>
        {cart.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><MdShoppingCart /></span>
            <p>{t('empty')}</p>
          </div>
        ) : (
          <>
            <div className={styles.items}>
              {cart.map(item => (
                <CartItem key={item.id} item={item} />
              ))}
            </div>

            <div className={styles.commentBox}>
              <p className={styles.commentLabel}>{t('order_comment')}</p>
              <textarea
                className={styles.textarea}
                placeholder={t('order_comment_placeholder')}
                value={orderComment}
                onChange={e => setOrderComment(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        {cart.length > 0 ? (
          <PrimaryButton
            label={`${t('confirm_offer')} ${cartTotal}₴`}
            onClick={() => navigate('/confirm')}
            disabled={cart.length === 0}
          />
        ) : null}
        <SecondaryButton
          label="1"
          onClick={() => navigate('/menu')}
        />
      </div>

      <Footer />
    </div>
  );
}