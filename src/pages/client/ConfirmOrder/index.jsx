import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/client/Header';
import ConfirmOrderItem from '../../../components/client/ConfirmOrderItem';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import styles from './confirmOrder.module.css';
import { useTranslation } from 'react-i18next';

import { MdTableRestaurant } from "react-icons/md";
import { MdEdit } from "react-icons/md";
import { MdCheck } from "react-icons/md";
import { MdErrorOutline } from "react-icons/md";

export default function ConfirmOrder() {
  const navigate = useNavigate();
  const {
    cart,
    cartTotal,
    tableNumber,
    addOrderToHistory,
    orderComment,
    submitOrder,
  } = useApp();
  const { t } = useTranslation('orderConfirmation');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  async function handleConfirm() {
    if (loading) return;
    setError(false);
    setLoading(true);
    try {
      // submitOrder() sends the real API request, sets currentOrder,
      // saves orderId to localStorage, and clears the cart.
      const normalized = await submitOrder();
      if (normalized) addOrderToHistory(normalized);
      navigate('/order-status');
    } catch (err) {
      console.error('Failed to place order:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Header title={t('confirmation_header')} showBack />

      <div className={styles.content}>
        <div className={styles.tableSection}>
          <span className={styles.tableIcon}><MdTableRestaurant /></span>
          <p className={styles.tableLabel}>{t('table_number')}</p>
          <p className={styles.tableNumber}>{t('order_number_info')} {tableNumber}</p>
        </div>

        <div className={styles.orderBox}>
          <p className={styles.boxTitle}>{t('your_order')}</p>
          {cart.map(item => (
            <ConfirmOrderItem key={item.cartItemId || item.id} item={item} />
          ))}
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>{t('total_label')}</span>
            <span className={styles.totalValue}>{cartTotal}₴</span>
          </div>
        </div>

        <div className={styles.commentBox}>
          <p className={styles.commentTitle}>{t('comment')}</p>
          <p className={styles.commentValue}>{orderComment || t('abcent')}</p>
        </div>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}><MdCheck /></span>
          <span className={styles.noticeText}>{t('snipet')}</span>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            <MdErrorOutline />
            <span>{t('submit_error') || 'Failed to place order. Please try again.'}</span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <PrimaryButton
          label={loading ? '…' : <><MdCheck /> {t('confirm_and_sent')}</>}
          onClick={handleConfirm}
          disabled={loading}
        />
        <SecondaryButton
          label={<><MdEdit /> {t('edit_order')}</>}
          onClick={() => navigate(-1)}
          disabled={loading}
        />
      </div>
    </div>
  );
}
