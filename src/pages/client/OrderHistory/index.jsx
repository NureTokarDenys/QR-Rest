import React, { use } from 'react';
import Header from '../../../components/client/Header';
import OrderHistoryCard from '../../../components/client/OrderHistoryCard';
import { useApp } from '../../../context/AppContext';
import styles from './orderHistory.module.css';
import { useTranslation } from 'react-i18next';

export default function OrderHistory() {
  const { orderHistory } = useApp();
  const { t } = useTranslation('myOrders');
  
  return (
    <div className={styles.page}>
      <Header title={t('header')} showBack />
      <div className={styles.content}>
        {orderHistory.map(order => (
          <OrderHistoryCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}