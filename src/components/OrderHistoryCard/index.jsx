import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MdHourglassTop, MdCheck, MdLocalFireDepartment } from "react-icons/md";
import styles from './orderHistoryCard.module.css';

export default function OrderHistoryCard({ order }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { t : t1  } = useTranslation('orderStatus'); 
  const { t : t2  } = useTranslation('myOrders'); 

  const statusConfig = {
    waiting: { label: <><MdHourglassTop /> {t1('status_waiting')}</>, className: 'waiting' }, 
    cooking: { label: <><MdLocalFireDepartment /> {t1('status_cooking')}</>, className: 'cooking' },
    ready: { label: <><MdCheck /> {t1('status_ready')}</>, className: 'ready' },
    served: { label: <><MdCheck /> {t1('status_served')}</>, className: 'served' },
  };

  const config = statusConfig[order.status] || statusConfig.waiting;

  const dateObj = new Date(order.date);
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'uk-UA';
  
  const timeStr = dateObj.toLocaleTimeString(locale, { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
  
  const dateStr = dateObj.toLocaleDateString(locale, { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  
  const formattedDate = `${timeStr} ${dateStr}`;

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.id}>{t2('order_label')} #{order.id}</span>
        <span className={`${styles.badge} ${styles[config.className]}`}>{config.label}</span>
      </div>
      
      <p className={styles.date}>{formattedDate}</p>
      
      <div className={styles.bottom}>
        <span className={styles.total}>{t2('total_sum')}: {order.total} {"₴"}</span>
        
        <button 
          className={styles.link} 
          onClick={() => navigate(`/order-status/${order.id}`)}
        >
          {t2('order_details')} ›
        </button>
      </div>
    </div>
  );
}