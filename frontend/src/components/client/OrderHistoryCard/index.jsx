import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';
import { MdHourglassTop, MdCheck, MdLocalFireDepartment, MdStorefront, MdClose, MdCreditCard, MdPayments } from "react-icons/md";
import styles from './orderHistoryCard.module.css';

export default function OrderHistoryCard({ order }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { t : t1  } = useTranslation('orderStatus');
  const { t : t2  } = useTranslation('myOrders');
  const local = useLocalField();

  const statusConfig = {
    // Active order states
    open:            { label: <><MdHourglassTop />        {t2('status_open')}</>,          className: 'waiting' },
    open_paid:       { label: <><MdPayments />            {t2('status_open_paid')}</>,      className: 'served'  },
    // Terminal states
    completed_cash:  { label: <><MdPayments />            {t2('status_completed_cash')}</>, className: 'served'  },
    completed_epay:  { label: <><MdCreditCard />          {t2('status_completed_epay')}</>, className: 'served'  },
    cancelled:       { label: <><MdClose />               {t2('status_cancelled')}</>,      className: 'void'    },
    // Legacy / dish-level statuses kept for old history entries
    waiting:         { label: <><MdHourglassTop />        {t1('status_waiting')}</>,        className: 'waiting' },
    cooking:         { label: <><MdLocalFireDepartment /> {t1('status_cooking')}</>,        className: 'cooking' },
    ready:           { label: <><MdCheck />               {t1('status_ready')}</>,          className: 'ready'   },
    served:          { label: <><MdCheck />               {t1('status_served')}</>,         className: 'served'  },
    completed:       { label: <><MdCheck />               {t1('status_served')}</>,         className: 'served'  },
    void:            { label: <><MdClose />               {t2('status_cancelled')}</>,      className: 'void'    },
    voided:          { label: <><MdClose />               {t2('status_cancelled')}</>,      className: 'void'    },
  };

  const config = statusConfig[order.status] || statusConfig.waiting;

  const dateObj = order.date ? new Date(order.date) : null;
  const locale  = i18n.resolvedLanguage === 'en' ? 'en-US' : 'uk-UA';
  const formattedDate = dateObj && !isNaN(dateObj)
    ? `${dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })} ${dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : '—';

  // Restaurant display name — order carries both UA and EN variants
  const restaurantDisplay = local(order, 'restaurantName') || order.restaurantName || order.restaurantId || '';

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.id}>{t2('order_label')} #{order.id}</span>
        <span className={`${styles.badge} ${styles[config.className]}`}>{config.label}</span>
      </div>

      {restaurantDisplay && (
        <p className={styles.restaurant}>
          <MdStorefront className={styles.restaurantIcon} />
          {restaurantDisplay}
        </p>
      )}

      <p className={styles.date}>{formattedDate}</p>

      <div className={styles.bottom}>
        <span className={styles.total}>{t2('total_sum')}: {order.total ?? 0} {"₴"}</span>
        <button
          className={styles.link}
          onClick={() => navigate(`/order-status/${order.id}`, { state: { restaurantId: order.restaurantId } })}
        >
          {t2('order_details')} ›
        </button>
      </div>
    </div>
  );
}