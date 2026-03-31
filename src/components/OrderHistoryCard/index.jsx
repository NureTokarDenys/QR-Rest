import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './orderHistoryCard.module.css';

const statusConfig = {
  cooking: { label: '🔥 Готується', className: 'cooking' },
  done: { label: '✅ Виконано', className: 'done' },
};

export default function OrderHistoryCard({ order }) {
  const navigate = useNavigate();
  const config = statusConfig[order.status] || statusConfig.done;

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.id}>Замовлення #{order.id}</span>
        <span className={`${styles.badge} ${styles[config.className]}`}>{config.label}</span>
      </div>
      <p className={styles.date}>{order.date}</p>
      <div className={styles.bottom}>
        <span className={styles.total}>Сума: {order.total}₴</span>
        <button className={styles.link} onClick={() => navigate('/order-status')}>
          Деталі замовлення ›
        </button>
      </div>
    </div>
  );
}