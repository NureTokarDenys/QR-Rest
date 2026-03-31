import React from 'react';
import Header from '../../../components/Header';
import OrderHistoryCard from '../../../components/OrderHistoryCard';
import { useApp } from '../../../context/AppContext';
import styles from './orderHistory.module.css';

export default function OrderHistory() {
  const { orderHistory } = useApp();
  
  return (
    <div className={styles.page}>
      <Header title="Мої замовлення" showBack />
      <div className={styles.content}>
        {orderHistory.map(order => (
          <OrderHistoryCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}