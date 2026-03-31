import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/Header';
import ConfirmOrderItem from '../../../components/ConfirmOrderItem';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import styles from './confirmOrder.module.css';

import { MdTableRestaurant } from "react-icons/md";
import { MdEdit } from "react-icons/md";
import { MdCheck } from "react-icons/md";

export default function ConfirmOrder() {
  const navigate = useNavigate();
  const { cart, cartTotal, tableNumber, clearCart, setCurrentOrder, addOrderToHistory } = useApp();

  function handleConfirm() {
    const order = {
      id: 'WL-042',
      tableNumber,
      items: cart.map(item => ({
        ...item,
        status: 'waiting',
      })),
      total: cartTotal,
    };
    setCurrentOrder(order);
    addOrderToHistory(order);
    clearCart();
    navigate('/order-status');
  }

  return (
    <div className={styles.page}>
      <Header title="Підтвердження замовлення" showBack />

      <div className={styles.content}>
        <div className={styles.tableSection}>
          <span className={styles.tableIcon}><MdTableRestaurant /></span>
          <p className={styles.tableLabel}>Ваш стіл</p>
          <p className={styles.tableNumber}>Стіл № {tableNumber}</p>
        </div>

        <div className={styles.orderBox}>
          <p className={styles.boxTitle}>Ваше замовлення</p>
          {cart.map(item => (
            <ConfirmOrderItem key={item.id} item={item} />
          ))}
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Всього до сплати</span>
            <span className={styles.totalValue}>{cartTotal}₴</span>
          </div>
        </div>

        <div className={styles.commentBox}>
          <p className={styles.commentTitle}>Коментар</p>
          <p className={styles.commentValue}>(відсутній)</p>
        </div>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}>✓</span>
          <span className={styles.noticeText}>Замовлення буде передано на кухню одразу після підтвердження</span>
        </div>
      </div>

      <div className={styles.footer}>
        <PrimaryButton label={<><MdCheck /> Підтвердити та надіслати</>} onClick={handleConfirm} />
        <SecondaryButton label={<><MdEdit /> Редагувати</>} onClick={() => navigate(-1)} />
      </div>
    </div>
  );
}