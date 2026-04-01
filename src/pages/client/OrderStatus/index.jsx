import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/Header';
import OrderStatusItem from '../../../components/OrderStatusItem';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/Footer';
import styles from './orderStatus.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { useTranslation } from 'react-i18next';

import { MdNotificationsActive } from "react-icons/md";
import { MdInfoOutline } from "react-icons/md";
import { MdLocalFireDepartment } from "react-icons/md";
import { MdCheck } from "react-icons/md";
import { MdCheckCircle } from "react-icons/md";

const STATUS_KEYS = ['waiting', 'cooking', 'ready', 'served'];

export default function OrderStatus() {
  const { t } = useTranslation('orderStatus');
  const local = useLocalField(); 
  const navigate = useNavigate();
  const { currentOrder, tableNumber } = useApp();

  const items = currentOrder?.items?.map((item, i) => ({
    ...item,
    status: item.status || "waiting",
    name: item.quantity > 1 ? `${local(item, 'name')} (×${item.quantity})` : local(item, 'name')
  }));

  const currentStatus = items && items.length > 0
    ? STATUS_KEYS[Math.min(...items.map(item => STATUS_KEYS.indexOf(item.status)))]
    : 'waiting';

  const activeStep = STATUS_KEYS.indexOf(currentStatus) !== -1 ? STATUS_KEYS.indexOf(currentStatus) : 0;

  const stepsLabels = STATUS_KEYS.map(key => t(`status_${key}`));

  const bannerConfig = {
    waiting: { 
      icon: <MdInfoOutline />, 
      title: t('snipet_waiting_title'), 
      subtitle: t('snipet_waiting_subtitle') 
    },
    cooking: { 
      icon: <MdLocalFireDepartment />, 
      title: t('snipet_cooking_title'), 
      subtitle: t('snipet_cooking_subtitle') 
    },
    ready: { 
      icon: <MdCheck />, 
      title: t('snipet_ready_title'), 
      subtitle: t('snipet_ready_subtitle') 
    },
    served: { 
      icon: <MdCheckCircle />, 
      title: t('snipet_served_title'), 
      subtitle: t('snipet_served_subtitle') 
    }
  };

  const currentBanner = bannerConfig[currentStatus] || bannerConfig['waiting'];

  return (
    <div className={styles.page}>
      <Header
        title={t('header')}
        showBack
        rightElement={<span className={styles.online}>● {t('online')}</span>}
      />

      <div className={styles.content}>
        <div className={styles.orderMeta}>
          <p className={styles.orderLabel}>{t('order')}</p>
          <p className={styles.orderId}>#{currentOrder?.id || 'WL-042'}</p>
          <p className={styles.tableInfo}>{t('table_number')}{tableNumber}</p>
        </div>

        <div className={styles.stepsCard}>
          <div className={styles.steps}>
            {stepsLabels.map((stepLabel, i) => (
              <React.Fragment key={STATUS_KEYS[i]}>
                <div className={styles.stepItem}>
                  <div className={`${styles.stepCircle} ${i < activeStep ? styles.done : i === activeStep ? styles.active : styles.idle}`}>
                    {i < activeStep ? '✓' : i + 1}
                  </div>
                  <span className={`${styles.stepLabel} ${i <= activeStep ? styles.stepLabelActive : ''}`}>{stepLabel}</span>
                </div>
                {i < stepsLabels.length - 1 && (
                  <div className={`${styles.line} ${i < activeStep ? styles.lineDone : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className={styles.statusBanner}>
            <span className={styles.statusIcon}>{currentBanner.icon}</span>
            <div>
              <p className={styles.bannerTitle}>{currentBanner.title}</p>
              <p className={styles.bannerSub}>{currentBanner.subtitle}</p>
            </div>
          </div>
        </div>

        <div className={styles.dishesCard}>
          <p className={styles.dishesTitle}>{t('dishes')}</p>
          {items?.map((item, i) => (
            <OrderStatusItem key={i} name={local(item, "name")} status={item.status} />
          ))}
        </div>

        <SecondaryButton label={<><MdNotificationsActive /> {t('waiter_call')}</>} onClick={() => {}} />
        <SecondaryButton label={`+ ${t('add_more')}`} onClick={() => navigate('/menu')} />
      </div>

      <Footer />
    </div>
  );
}