import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { normalizeApiOrder } from '../../../context/AppContext';
import { getOrder, cancelGuestOrder, cancelGuestServingGroup, waiterCall, waiterCallCash, initiatePayment } from '../../../api/orders';
import Header from '../../../components/client/Header';
import OrderStatusItem from '../../../components/client/OrderStatusItem';
import WsStatusBanner from '../../../components/WsStatusBanner';
import WsStatusChip from '../../../components/WsStatusChip';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/client/Footer';
import styles from './orderStatus.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { useTranslation } from 'react-i18next';

import { MdNotificationsActive, MdInfoOutline, MdLocalFireDepartment, MdCheck, MdCheckCircle, MdPayments, MdCreditCard, MdNotifications, MdExpandMore, MdExpandLess } from "react-icons/md";

const DISH_STATUSES = ['waiting', 'cooking', 'ready', 'served'];
const TERMINAL_STATUSES = ['cancelled', 'completed_cash', 'completed_epay'];

export default function OrderStatus() {
  const { t, i18n } = useTranslation('orderStatus');
  const local = useLocalField();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const {
    currentOrder, setCurrentOrder, tableNumber, orderHistory, sessionToken, startEditingOrder,
    addWsListener, removeWsListener, wsStatus, wsLatency,
    notifications, unreadCount, markAllRead,
  } = useApp();

  // ── Payment state ──────────────────────────────────────────────────────────
  const [callSent, setCallSent]               = useState(null);
  const [liqpayLoading, setLiqpayLoading]     = useState(false);
  const [showPayWarning, setShowPayWarning]   = useState(false);
  const [showCashExpand, setShowCashExpand]   = useState(false);
  const [showCashWarning, setShowCashWarning] = useState(false);

  async function handleLiqPay() {
    if (!activeOrder || liqpayLoading) return;
    setShowPayWarning(false);
    setLiqpayLoading(true);
    try {
      const payload = await initiatePayment(activeOrder.id);
      if (!payload?.data || !payload?.signature) return;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://www.liqpay.ua/api/3/checkout';
      form.acceptCharset = 'utf-8';
      const di = document.createElement('input');
      di.type = 'hidden'; di.name = 'data'; di.value = payload.data;
      const si = document.createElement('input');
      si.type = 'hidden'; si.name = 'signature'; si.value = payload.signature;
      form.appendChild(di); form.appendChild(si);
      document.body.appendChild(form);
      form.submit();
    } catch (_) {
      setLiqpayLoading(false);
    }
  }

  async function handleCashCall() {
    if (!activeOrder) return;
    setShowCashWarning(false);
    try {
      await waiterCallCash(activeOrder.id);
      setCallSent('cash');
      setShowCashExpand(false);
      setTimeout(() => setCallSent(null), 4000);
    } catch (_) {}
  }

  async function handleWaiterCall() {
    if (!activeOrder) return;
    try {
      await waiterCall(activeOrder.id);
      setCallSent('general');
      setTimeout(() => setCallSent(null), 4000);
    } catch (_) {}
  }

  // ── Cancel state ───────────────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling]     = useState(false);
  const [cancelError, setCancelError]   = useState('');

  async function handleCancel() {
    const token = sessionToken || localStorage.getItem('sessionToken');
    if (!token || !activeOrder) return;
    setCancelling(true);
    setCancelError('');
    try {
      if (cancelTarget === 'order') {
        await cancelGuestOrder(activeOrder.id, token);
      } else {
        await cancelGuestServingGroup(activeOrder.id, cancelTarget, token);
      }
      const fresh = await getOrder(activeOrder.id);
      if (fresh) setCurrentOrder(normalizeApiOrder(fresh));
      setCancelTarget(null);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || t('cancel_blocked');
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  }

  // ── Notification panel ─────────────────────────────────────────────────────
  const [showNotifs, setShowNotifs] = useState(false);
  const isEn = i18n.language === 'en';


  function toggleNotifs() {
    if (!showNotifs) markAllRead();
    setShowNotifs(v => !v);
  }

  // ── Fetch order when navigating to /order-status/:id from history ──────────
  const [fetchedOrder, setFetchedOrder] = useState(null);
  useEffect(() => {
    if (!orderId) return;
    if (currentOrder?.id === orderId) return;
    if (orderHistory?.some(o => o.id === orderId)) return;
    getOrder(orderId)
      .then(data => { if (data) setFetchedOrder(normalizeApiOrder(data)); })
      .catch(() => {});
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket — use global connection from AppContext ──────────────────────
  const handleWsMessage = useCallback((msg) => {
    const { event, payload } = msg;
    if (!payload) return;

    function applyEvent(prev) {
      if (!prev) return prev;
      const isRelevant = !payload.orderId || String(payload.orderId) === String(prev.id);
      if (!isRelevant) return prev;

      if (event === 'ORDER_UPDATED') {
        return { ...prev, ...(payload.status ? { status: payload.status } : {}) };
      }
      if (event === 'ORDER_CANCELLED' || event === 'ORDER_VOID') {
        return { ...prev, status: 'cancelled' };
      }
      if (event === 'PAYMENT_COMPLETED') {
        return { ...prev, status: 'open_paid', paymentMethod: payload.method };
      }
      if (event === 'ORDER_COMPLETED') {
        return { ...prev, status: payload.status || prev.status };
      }
      if (event === 'DISH_STATUS_UPDATED') {
        return {
          ...prev,
          items: prev.items.map(item =>
            item.orderItemId && String(item.orderItemId) === String(payload.orderItemId)
              ? { ...item, status: payload.dishStatus }
              : item
          ),
        };
      }
      if (event === 'GROUP_STATUS_UPDATED') {
        return {
          ...prev,
          items: prev.items.map(item =>
            String(item.groupId) === String(payload.groupId)
              ? { ...item, status: payload.status }
              : item
          ),
        };
      }
      return prev;
    }

    setCurrentOrder(applyEvent);
    setFetchedOrder(applyEvent);
  }, [setCurrentOrder, setFetchedOrder]);

  useEffect(() => {
    addWsListener(handleWsMessage);
    return () => removeWsListener(handleWsMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve active order ───────────────────────────────────────────────────
  const activeOrder = !orderId
    ? currentOrder
    : (currentOrder?.id === orderId
        ? currentOrder
        : (orderHistory?.find(order => order.id === orderId) ?? fetchedOrder));

  if (!activeOrder) {
    const isFetching = orderId && !fetchedOrder;
    return (
      <div className={styles.page}>
        <Header title={t('header')} showBack />
        <div className={styles.content}>
          <p className={styles.not_found}>{isFetching ? '…' : t('order_not_found')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const allItems = (activeOrder.items || []).map(item => ({
    ...item,
    status:  item.status  || 'waiting',
    groupId: item.groupId || 'main',
  }));

  const orderGroups = (activeOrder.servingGroups && activeOrder.servingGroups.length > 0)
    ? activeOrder.servingGroups
    : [{ id: 'main', name: 'Основна група', name_en: 'Main group' }];

  const knownGroupIds = new Set(orderGroups.map(g => g.id));
  const groupedSections = orderGroups.map(group => ({
    group,
    items: allItems.filter(item => item.groupId === group.id),
  }));
  const orphanItems = allItems.filter(item => !knownGroupIds.has(item.groupId));

  const worstStatusIndex = allItems.length > 0
    ? Math.min(...allItems.map(item => {
        const idx = DISH_STATUSES.indexOf(item.status);
        return idx === -1 ? 0 : idx;
      }))
    : 0;

  const currentStatus = DISH_STATUSES[worstStatusIndex] || 'waiting';
  const activeStep    = worstStatusIndex;
  const stepsLabels   = DISH_STATUSES.map(key => t(`status_${key}`));

  const isOrderTerminal = TERMINAL_STATUSES.includes(activeOrder.status);
  const isOpenPaid      = activeOrder.status === 'open_paid';
  const isOrderDone     = currentStatus === 'served' || isOrderTerminal || isOpenPaid;
  const allServed       = allItems.length > 0 && allItems.every(i => i.status === 'served');
  const showPayment     = allServed && !isOrderTerminal && !isOpenPaid;

  const bannerConfig = {
    waiting: { icon: <MdInfoOutline />,         title: t('snipet_waiting_title'), subtitle: t('snipet_waiting_subtitle') },
    cooking: { icon: <MdLocalFireDepartment />,  title: t('snipet_cooking_title'), subtitle: t('snipet_cooking_subtitle') },
    ready:   { icon: <MdCheck />,               title: t('snipet_ready_title'),   subtitle: t('snipet_ready_subtitle')   },
    served:  { icon: <MdCheckCircle />,          title: t('snipet_served_title'),  subtitle: t('snipet_served_subtitle')  },
  };
  const currentBanner = bannerConfig[currentStatus] || bannerConfig.waiting;

  return (
    <div className={styles.page}>
      <Header
        title={t('header')}
        showBack
        rightElement={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Notification bell */}
            <button
              className={styles.notifBell}
              onClick={toggleNotifs}
              aria-label="Notifications"
            >
              <MdNotifications />
              {unreadCount > 0 && (
                <span className={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {/* WS status chip — responsive (dot-only on mobile) */}
            <WsStatusChip status={wsStatus} latency={wsLatency} />
          </div>
        }
      />
      <WsStatusBanner status={wsStatus} />

      <div className={styles.content}>
        {/* ── Order meta ── */}
        <div className={styles.orderMeta}>
          <p className={styles.orderLabel}>{t('order')}</p>
          <p className={styles.orderId}>#{activeOrder.id}</p>
          <p className={styles.tableInfo}>{t('table_number')}{tableNumber}</p>
        </div>

        {/* ── Notifications panel ── */}
        {showNotifs && (
          <div className={styles.notifPanel}>
            <div className={styles.notifPanelHeader}>
              <span>{t('notifications') ?? 'Сповіщення'}</span>
              <button className={styles.notifClose} onClick={() => setShowNotifs(false)}>✕</button>
            </div>
            {notifications.length === 0 ? (
              <p className={styles.notifEmpty}>{t('no_notifications') ?? 'Немає сповіщень'}</p>
            ) : (
              <ul className={styles.notifList}>
                {notifications.map(n => (
                  <li key={n._id} className={`${styles.notifItem} ${n.readAt ? styles.notifRead : ''}`}>
                    <span className={styles.notifTitle}>{isEn ? n.title_en : n.title_uk}</span>
                    {(isEn ? n.body_en : n.body_uk) ? (
                      <span className={styles.notifBody}>{isEn ? n.body_en : n.body_uk}</span>
                    ) : null}
                    <span className={styles.notifTime}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── open_paid banner ── */}
        {isOpenPaid && (
          <div className={styles.paidBanner}>
            <MdCheckCircle className={styles.paidBannerIcon} />
            <div>
              <p className={styles.paidBannerTitle}>{t('paid_banner_title') ?? 'Оплату отримано'}</p>
              <p className={styles.paidBannerSub}>{t('paid_banner_sub') ?? 'Кухня ще готує — стіл буде закрито офіціантом'}</p>
            </div>
          </div>
        )}

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

        {/* ── Order items ── */}
        <div className={styles.dishesCard}>
          <p className={styles.dishesTitle}>{t('dishes')}</p>

          {groupedSections.map(({ group, items: gItems }, sectionIdx) => {
            const groupAllWaiting = gItems.length > 0 && gItems.every(i => i.status === 'waiting');
            const isTargeted = cancelTarget === group.id;
            return (
              <div
                key={group.id}
                className={`${styles.groupSection} ${sectionIdx > 0 ? styles.groupSectionGap : ''}`}
              >
                <div className={styles.groupHeader}>
                  <p className={styles.groupLabel}>{local(group, 'name')}</p>
                  {groupAllWaiting && !isOrderDone && groupedSections.length > 1 && (
                    <button
                      className={styles.cancelGroupBtn}
                      onClick={() => { setCancelTarget(isTargeted ? null : group.id); setCancelError(''); }}
                    >
                      {t('cancel_group')}
                    </button>
                  )}
                </div>

                {isTargeted && (
                  <div className={styles.cancelConfirm}>
                    <div className={styles.cancelConfirmText}>
                      <div>{t('cancel_confirm_group')}</div>
                      <div className={styles.cancelConfirmHint}>{t('cancel_hint')}</div>
                      {cancelError && <div className={styles.cancelConfirmHint} style={{ color: '#dc2626' }}>{cancelError}</div>}
                    </div>
                    <button className={styles.cancelYesBtn} onClick={handleCancel} disabled={cancelling}>
                      {cancelling ? '…' : t('cancel_yes')}
                    </button>
                    <button className={styles.cancelNoBtn} onClick={() => { setCancelTarget(null); setCancelError(''); }}>
                      {t('cancel_no')}
                    </button>
                  </div>
                )}

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
            );
          })}

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
        {showPayment ? (
          <>
            {/* Payment warning */}
            {showPayWarning && (
              <div className={styles.payWarning}>
                <p className={styles.payWarningText}>
                  {t('pay_warning') ?? '⚠️ Після оплати додавання страв буде заблоковано. Продовжити?'}
                </p>
                <div className={styles.payWarningActions}>
                  <button className={styles.payConfirmBtn} onClick={handleLiqPay} disabled={liqpayLoading}>
                    {liqpayLoading ? '…' : t('pay_confirm') ?? 'Так, сплатити онлайн'}
                  </button>
                  <button className={styles.cancelNoBtn} onClick={() => setShowPayWarning(false)}>
                    {t('cancel_no')}
                  </button>
                </div>
              </div>
            )}

            {!showPayWarning && (
              <button
                className={styles.payLiqpayBtn}
                onClick={() => setShowPayWarning(true)}
                disabled={liqpayLoading}
              >
                <MdCreditCard />
                {t('pay_liqpay')}
              </button>
            )}

            {/* Cash payment expandable */}
            <div className={styles.cashSection}>
              <button
                className={styles.cashToggle}
                onClick={() => { setShowCashExpand(v => !v); setShowCashWarning(false); }}
              >
                <MdPayments />
                <span>{t('waiter_call_cash')}</span>
                {showCashExpand ? <MdExpandLess /> : <MdExpandMore />}
              </button>

              {showCashExpand && (
                <div className={styles.cashExpand}>
                  {callSent === 'cash' ? (
                    <div className={styles.callSentMsg}>{t('cash_call_sent')}</div>
                  ) : showCashWarning ? (
                    <div className={styles.payWarning}>
                      <p className={styles.payWarningText}>
                        {t('cash_warning') ?? '⚠️ Після підтвердження оплати готівкою замовлення буде заблоковано.'}
                      </p>
                      <div className={styles.payWarningActions}>
                        <button className={styles.payConfirmBtn} onClick={handleCashCall}>
                          {t('pay_confirm') ?? 'Підтвердити'}
                        </button>
                        <button className={styles.cancelNoBtn} onClick={() => setShowCashWarning(false)}>
                          {t('cancel_no')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SecondaryButton
                      label={t('request_cash_payment') ?? 'Попросити рахунок готівкою'}
                      onClick={() => setShowCashWarning(true)}
                    />
                  )}
                </div>
              )}
            </div>

            <SecondaryButton
              label={`+ ${t('add_more')}`}
              onClick={() => { startEditingOrder(activeOrder); navigate('/menu'); }}
            />
          </>
        ) : !isOrderDone ? (
          <>
            {callSent === 'general' ? (
              <div className={styles.callSentMsg}>{t('waiter_call_sent')}</div>
            ) : (
              <SecondaryButton
                label={<><MdNotificationsActive /> {t('waiter_call')}</>}
                onClick={handleWaiterCall}
                disabled={isOrderTerminal}
              />
            )}

            <SecondaryButton
              label={`+ ${t('add_more')}`}
              onClick={() => { startEditingOrder(activeOrder); navigate('/menu'); }}
              disabled={isOrderTerminal}
            />
          </>
        ) : null}

        {/* Cancel whole order — only when all items are still waiting */}
        {allItems.length > 0 && allItems.every(i => i.status === 'waiting') && !isOrderDone && (
          cancelTarget === 'order' ? (
            <div className={styles.cancelConfirm}>
              <div className={styles.cancelConfirmText}>
                <div>{t('cancel_confirm_order')}</div>
                <div className={styles.cancelConfirmHint}>{t('cancel_hint')}</div>
                {cancelError && <div className={styles.cancelConfirmHint} style={{ color: '#dc2626' }}>{cancelError}</div>}
              </div>
              <button className={styles.cancelYesBtn} onClick={handleCancel} disabled={cancelling}>
                {cancelling ? '…' : t('cancel_yes')}
              </button>
              <button className={styles.cancelNoBtn} onClick={() => { setCancelTarget(null); setCancelError(''); }}>
                {t('cancel_no')}
              </button>
            </div>
          ) : (
            <button
              className={styles.cancelOrderBtn}
              onClick={() => { setCancelTarget('order'); setCancelError(''); }}
            >
              {t('cancel_order')}
            </button>
          )
        )}
      </div>

      <Footer />
    </div>
  );
}
