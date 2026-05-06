import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/client/Header';
import OrderStatusItem from '../../../components/client/OrderStatusItem';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/client/Footer';
import styles from './orderStatus.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { useTranslation } from 'react-i18next';

import { MdNotificationsActive } from "react-icons/md";
import { MdInfoOutline } from "react-icons/md";
import { MdLocalFireDepartment } from "react-icons/md";
import { MdCheck } from "react-icons/md";
import { MdCheckCircle } from "react-icons/md";

// Domain model DishStatus values (monotonically increasing)
const DISH_STATUSES = ['waiting', 'cooking', 'ready', 'served'];

export default function OrderStatus() {
  const { t } = useTranslation('orderStatus');
  const local = useLocalField();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { currentOrder, tableNumber, orderHistory } = useApp();

  // Resolution priority:
  //   1. No orderId param              → live currentOrder
  //   2. orderId matches currentOrder  → live currentOrder (handles API-restored
  //                                      orders that were never pushed to history)
  //   3. orderId is a past order       → find in orderHistory
  const activeOrder = !orderId
    ? currentOrder
    : (currentOrder?.id === orderId
        ? currentOrder
        : orderHistory?.find(order => order.id === orderId));

  if (!activeOrder) {
    return (
      <div className={styles.page}>
        <Header title={t('header')} showBack />
        <div className={styles.content}>
          <p className={styles.not_found}>{t('order_not_found')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Normalise items ───────────────────────────────────────────────────────
  // Every item must have a valid status and a groupId.
  const allItems = (activeOrder.items || []).map(item => ({
    ...item,
    status:  item.status  || 'waiting',
    groupId: item.groupId || 'main',
  }));

  // ── Build Order → ServingGroups → Items hierarchy ─────────────────────────
  // The domain model guarantees every order has ≥1 ServingGroup and every
  // item belongs to exactly one ServingGroup via servingGroupId.
  //
  // normalizeApiOrder already maps servingGroups from the API; fall back to a
  // single default group when the order comes from a local mock (history).
  const orderGroups = (activeOrder.servingGroups && activeOrder.servingGroups.length > 0)
    ? activeOrder.servingGroups
    : [{ id: 'main', name: 'Основна група', name_en: 'Main group' }];

  // Match items to their group; collect any orphans (mismatched groupId)
  const knownGroupIds = new Set(orderGroups.map(g => g.id));
  const groupedSections = orderGroups.map(group => ({
    group,
    items: allItems.filter(item => item.groupId === group.id),
  }));

  // Items whose groupId doesn't match any known group → show in an "Other" section
  const orphanItems = allItems.filter(item => !knownGroupIds.has(item.groupId));

  // ── Overall progress (driven by the earliest dish status) ─────────────────
  // Finds the minimum status across all items so the tracker shows the
  // current bottleneck stage.
  const worstStatusIndex = allItems.length > 0
    ? Math.min(...allItems.map(item => {
        const idx = DISH_STATUSES.indexOf(item.status);
        return idx === -1 ? 0 : idx;
      }))
    : 0;

  const currentStatus = DISH_STATUSES[worstStatusIndex] || 'waiting';
  const activeStep    = worstStatusIndex;

  const stepsLabels = DISH_STATUSES.map(key => t(`status_${key}`));

  const isOrderDone = currentStatus === 'served';

  const bannerConfig = {
    waiting: {
      icon:     <MdInfoOutline />,
      title:    t('snipet_waiting_title'),
      subtitle: t('snipet_waiting_subtitle'),
    },
    cooking: {
      icon:     <MdLocalFireDepartment />,
      title:    t('snipet_cooking_title'),
      subtitle: t('snipet_cooking_subtitle'),
    },
    ready: {
      icon:     <MdCheck />,
      title:    t('snipet_ready_title'),
      subtitle: t('snipet_ready_subtitle'),
    },
    served: {
      icon:     <MdCheckCircle />,
      title:    t('snipet_served_title'),
      subtitle: t('snipet_served_subtitle'),
    },
  };

  const currentBanner = bannerConfig[currentStatus] || bannerConfig.waiting;

  return (
    <div className={styles.page}>
      <Header
        title={t('header')}
        showBack
        rightElement={<span className={styles.online}>● {t('online')}</span>}
      />

      <div className={styles.content}>
        {/* ── Order meta ── */}
        <div className={styles.orderMeta}>
          <p className={styles.orderLabel}>{t('order')}</p>
          <p className={styles.orderId}>#{activeOrder.id}</p>
          <p className={styles.tableInfo}>{t('table_number')}{tableNumber}</p>
        </div>

        {/* ── Progress tracker ── */}
        <div className={styles.stepsCard}>
          <div className={styles.steps}>
            {stepsLabels.map((stepLabel, i) => (
              <React.Fragment key={DISH_STATUSES[i]}>
                <div className={styles.stepItem}>
                  <div className={`${styles.stepCircle} ${
                    i < activeStep  ? styles.done   :
                    i === activeStep ? styles.active :
                                       styles.idle
                  }`}>
                    {i < activeStep ? '✓' : i + 1}
                  </div>
                  <span className={`${styles.stepLabel} ${i <= activeStep ? styles.stepLabelActive : ''}`}>
                    {stepLabel}
                  </span>
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

        {/* ── Order → ServingGroups → OrderItems ── */}
        <div className={styles.dishesCard}>
          <p className={styles.dishesTitle}>{t('dishes')}</p>

          {groupedSections.map(({ group, items: gItems }, sectionIdx) => (
            <div
              key={group.id}
              className={`${styles.groupSection} ${sectionIdx > 0 ? styles.groupSectionGap : ''}`}
            >
              {/* Group header — always shown per the domain model */}
              <p className={styles.groupLabel}>{local(group, 'name')}</p>

              {gItems.length === 0 ? (
                <p className={styles.emptyGroup}>—</p>
              ) : (
                gItems.map((item, i) => (
                  <OrderStatusItem
                    key={item.id ? `${item.id}-${i}` : i}
                    name={item.quantity > 1
                      ? `${local(item, 'name')} (×${item.quantity})`
                      : local(item, 'name')
                    }
                    status={item.status}
                  />
                ))
              )}
            </div>
          ))}

          {/* Orphan items — served by a group not in the groups list (data mismatch safety net) */}
          {orphanItems.length > 0 && (
            <div className={`${styles.groupSection} ${styles.groupSectionGap}`}>
              <p className={styles.groupLabel}>—</p>
              {orphanItems.map((item, i) => (
                <OrderStatusItem
                  key={item.id ? `orphan-${item.id}-${i}` : `orphan-${i}`}
                  name={item.quantity > 1
                    ? `${local(item, 'name')} (×${item.quantity})`
                    : local(item, 'name')
                  }
                  status={item.status}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <SecondaryButton
          label={<><MdNotificationsActive /> {t('waiter_call')}</>}
          onClick={() => {}}
          disabled={isOrderDone}
        />
        <SecondaryButton
          label={`+ ${t('add_more')}`}
          onClick={() => navigate('/menu')}
          disabled={isOrderDone}
        />
      </div>

      <Footer />
    </div>
  );
}
