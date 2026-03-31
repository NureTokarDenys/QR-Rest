import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/Header';
import OrderStatusItem from '../../../components/OrderStatusItem';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/Footer';
import styles from './orderStatus.module.css';

import { MdNotificationsActive } from "react-icons/md";

const steps = ['В черзі', 'Готується', 'Готово', 'Подано'];

const MOCK_ITEMS = [
  { id: 1, name: 'Деруни з м\'ясом', status: 'waiting' },
  { id: 2, name: 'Шніцель (×2)', status: 'cooking' },
  { id: 3, name: 'Спагетті', status: 'ready' },
];

export default function OrderStatus() {
  const navigate = useNavigate();
  const { currentOrder, tableNumber } = useApp();
  const activeStep = 2;

  const items = currentOrder?.items?.map((item, i) => ({
    ...item,
    status: MOCK_ITEMS[i % MOCK_ITEMS.length]?.status || 'waiting',
    name: item.quantity > 1 ? `${item.name} (×${item.quantity})` : item.name,
  })) || MOCK_ITEMS;

  return (
    <div className={styles.page}>
      <Header
        title="Статус замовлення"
        showBack
        rightElement={<span className={styles.online}>● Онлайн</span>}
      />

      <div className={styles.content}>
        <div className={styles.orderMeta}>
          <p className={styles.orderLabel}>Замовлення</p>
          <p className={styles.orderId}>#{currentOrder?.id || 'WL-042'}</p>
          <p className={styles.tableInfo}>Стіл №{tableNumber}</p>
        </div>

        <div className={styles.stepsCard}>
          <div className={styles.steps}>
            {steps.map((step, i) => (
              <React.Fragment key={step}>
                <div className={styles.stepItem}>
                  <div className={`${styles.stepCircle} ${i < activeStep ? styles.done : i === activeStep ? styles.active : styles.idle}`}>
                    {i < activeStep ? '✓' : i + 1}
                  </div>
                  <span className={`${styles.stepLabel} ${i <= activeStep ? styles.stepLabelActive : ''}`}>{step}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`${styles.line} ${i < activeStep ? styles.lineDone : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className={styles.statusBanner}>
            <span>🔍</span>
            <div>
              <p className={styles.bannerTitle}>Ваше замовлення готується</p>
              <p className={styles.bannerSub}>Приблизний час готовності: ~8 хв</p>
            </div>
          </div>
        </div>

        <div className={styles.dishesCard}>
          <p className={styles.dishesTitle}>СТРАВИ</p>
          {items.map((item, i) => (
            <OrderStatusItem key={i} name={item.name} status={item.status} />
          ))}
        </div>

        <SecondaryButton label={<><MdNotificationsActive /> Викликати офіціанта</>} onClick={() => {}} />
        <SecondaryButton label="+ Додати до замовлення" onClick={() => navigate('/menu')} />
      </div>

      <Footer />
    </div>
  );
}