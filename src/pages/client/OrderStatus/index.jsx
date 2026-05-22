import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { normalizeApiOrder } from '../../../context/AppContext';
import { usePlan } from '../../../hooks/usePlan';
import { getOrder, cancelGuestOrder, cancelGuestServingGroup, waiterCall, waiterCallCash, initiatePayment } from '../../../api/orders';
import Header from '../../../components/client/Header';
import OrderStatusItem from '../../../components/client/OrderStatusItem';
import WsStatusBanner from '../../../components/WsStatusBanner';
import WsStatusChip from '../../../components/WsStatusChip';
import SecondaryButton from '../../../components/SecondaryButton';
import Footer from '../../../components/client/Footer';
import OrderReviews from '../../../components/client/OrderReviews';
import styles from './orderStatus.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { useTranslation } from 'react-i18next';

import { MdNotificationsActive, MdInfoOutline, MdLocalFireDepartment, MdCheck, MdCheckCircle, MdPayments, MdCreditCard, MdNotifications, MdExpandMore, MdExpandLess, MdStorefront } from "react-icons/md";

const DISH_STATUSES = ['waiting', 'cooking', 'ready', 'served'];
// 5-step progress bar shown to the guest: dish-progression + final paid step.
// 'completed' is an order-level state, NOT a dish status — it lights up when
// the order is open_paid (paid-in-advance) or in any terminal completed_* state.
const STEPPER_KEYS = [...DISH_STATUSES, 'completed'];
const TERMINAL_STATUSES = ['cancelled', 'completed_cash', 'completed_epay'];

export default function OrderStatus() {
  const { t, i18n } = useTranslation('orderStatus');
  const local = useLocalField();
  const { isFree } = usePlan();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentOrder, setCurrentOrder, tableNumber, orderHistory, sessionToken, startEditingOrder,
    addWsListener, removeWsListener, wsStatus, wsLatency,
    notifications, unreadCount, markAllRead, refreshNotifications,
    restaurantName, restaurantName_en, restaurantId,
  } = useApp();

  // ── Waiter call state ─────────────────────────────────────────────────────
  // 'idle' | 'pending' | 'answered' | 'cooldown'
  const [callState, setCallState]             = useState('idle');
  const [callInfo, setCallInfo]               = useState(null); // { callId, startedAt, answeredAt }
  const [callCooldownMsg, setCallCooldownMsg] = useState(false);
  const callStateRef = useRef('idle');
  callStateRef.current = callState; // always current, no stale-closure risk
  const [callElapsed, setCallElapsed] = useState(0);

  // ── Payment state ──────────────────────────────────────────────────────────
  const [callSent, setCallSent]               = useState(null); // cash only
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
    const cs = callStateRef.current;
    if (cs === 'pending') return;
    if (cs === 'answered' || cs === 'cooldown') {
      setCallCooldownMsg(true);
      setTimeout(() => setCallCooldownMsg(false), 3500);
      return;
    }
    try {
      const data = await waiterCall(activeOrder.id);
      const startedAt = Date.now();
      const callId = data?.callId ?? null;
      setCallState('pending');
      setCallInfo({ callId, startedAt, answeredAt: null });
      localStorage.setItem(`wcPending_${activeOrder.id}`, JSON.stringify({ callId, startedAt }));
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      if (code === 'ACTIVE_CALL_EXISTS') {
        const startedAt = Date.now();
        setCallState('pending');
        setCallInfo({ callId: null, startedAt, answeredAt: null });
        localStorage.setItem(`wcPending_${activeOrder.id}`, JSON.stringify({ callId: null, startedAt }));
      }
    }
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

  // activeOrderId is resolved after the early-return guard below, so we store
  // it in a ref that toggleNotifs / item clicks can reach without prop-drilling.
  const activeOrderIdRef = useRef(null);

  // Auto-open + mark-read when navigated here from a toast tap.
  // Uses a small timeout so activeOrderIdRef is populated on the first render.
  useEffect(() => {
    if (!location.state?.openNotifs) return;
    const t = setTimeout(() => {
      setShowNotifs(true);
      markAllRead(activeOrderIdRef.current);
    }, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleNotifs() {
    if (!showNotifs) markAllRead(activeOrderIdRef.current);
    setShowNotifs(v => !v);
  }

  // ── Fetch order when navigating to /order-status/:id from history ──────────
  // The order may belong to a DIFFERENT restaurant than the one currently
  // stored — history can span any place the user has ordered from. The
  // history card passes the order's restaurantId via navigation state so we
  // hit the right scoped endpoint instead of falling back to the stored one.
  const [fetchedOrder, setFetchedOrder] = useState(null);
  useEffect(() => {
    if (!orderId) return;
    if (currentOrder?.id === orderId) return;
    if (orderHistory?.some(o => o.id === orderId)) return;
    const historicalRestaurantId = location.state?.restaurantId;
    getOrder(orderId, historicalRestaurantId)
      .then(data => { if (data) setFetchedOrder(normalizeApiOrder(data)); })
      .catch(() => {});
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket — use global connection from AppContext ──────────────────────
  const handleWsMessage = useCallback((msg) => {
    const { event, payload } = msg;
    if (!payload) return;

    if (event === 'WAITER_CALL_RESOLVED') {
      const answeredAt = Date.now();
      setCallState('answered');
      setCallInfo(prev => ({ ...(prev || {}), answeredAt }));
      const oid = activeOrderIdRef.current;
      if (oid) {
        localStorage.removeItem(`wcPending_${oid}`);
        localStorage.setItem(`wcAnswered_${oid}`, JSON.stringify({ callId: payload.callId, answeredAt }));
      }
      return;
    }

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
  }, [setCurrentOrder, setFetchedOrder, setCallState, setCallInfo]);

  useEffect(() => {
    addWsListener(handleWsMessage);
    return () => removeWsListener(handleWsMessage);
  }, [handleWsMessage, addWsListener, removeWsListener]);

  // Load notifications for this order when they haven't been fetched yet.
  // Guests need this: after a page reload currentOrder is null so the AppContext
  // effect never fires, but the orderId is known from the URL param.
  // For history navigation, prefer the historical order's restaurantId — the
  // stored one points to the *current* session's place which may not match.
  const resolvedOrderId = orderId || currentOrder?.id;
  const resolvedRestaurantId = location.state?.restaurantId || restaurantId;
  useEffect(() => {
    if (!resolvedOrderId || !resolvedRestaurantId || notifications.length > 0) return;
    refreshNotifications(resolvedOrderId, resolvedRestaurantId);
  }, [resolvedOrderId, resolvedRestaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore answered/cooldown or pending state after a page reload
  useEffect(() => {
    if (!resolvedOrderId) return;

    const answeredRaw = localStorage.getItem(`wcAnswered_${resolvedOrderId}`);
    if (answeredRaw) {
      try {
        const { callId, answeredAt } = JSON.parse(answeredRaw);
        if (Date.now() - answeredAt < 60_000) {
          setCallState('cooldown');
          setCallInfo({ callId, startedAt: null, answeredAt });
          return;
        } else {
          localStorage.removeItem(`wcAnswered_${resolvedOrderId}`);
        }
      } catch { localStorage.removeItem(`wcAnswered_${resolvedOrderId}`); }
    }

    const pendingRaw = localStorage.getItem(`wcPending_${resolvedOrderId}`);
    if (pendingRaw) {
      try {
        const { callId, startedAt } = JSON.parse(pendingRaw);
        setCallState('pending');
        setCallInfo({ callId, startedAt, answeredAt: null });
      } catch { localStorage.removeItem(`wcPending_${resolvedOrderId}`); }
    }
  }, [resolvedOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live elapsed timer — only runs while a call is pending
  useEffect(() => {
    if (callState !== 'pending' || !callInfo?.startedAt) { setCallElapsed(0); return; }
    const tick = () => setCallElapsed(Math.floor((Date.now() - callInfo.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callState, callInfo?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expire answered/cooldown state after the 60-second window
  useEffect(() => {
    if (callState !== 'answered' && callState !== 'cooldown') return;
    const answeredAt = callInfo?.answeredAt;
    if (!answeredAt) return;
    const remaining = 60_000 - (Date.now() - answeredAt);
    if (remaining <= 0) { setCallState('idle'); setCallInfo(null); return; }
    const tid = setTimeout(() => { setCallState('idle'); setCallInfo(null); }, remaining);
    return () => clearTimeout(tid);
  }, [callState, callInfo?.answeredAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve active order ───────────────────────────────────────────────────
  const activeOrder = !orderId
    ? currentOrder
    : (currentOrder?.id === orderId
        ? currentOrder
        : (orderHistory?.find(order => order.id === orderId) ?? fetchedOrder));

  if (!activeOrder) {
    // Guest has no URL param but has a stored orderId — redirect so the fetch
    // effect can load the order properly (and the URL becomes shareable/reloadable).
    if (!orderId) {
      const storedId = localStorage.getItem('orderId');
      if (storedId) {
        navigate(`/order-status/${storedId}`, { replace: true });
        return null;
      }
    }
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

  // Keep ref in sync so async callbacks (toggleNotifs, item clicks) use the right id.
  activeOrderIdRef.current = activeOrder.id;

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
  const stepsLabels   = STEPPER_KEYS.map(key => t(`status_${key}`));

  const isOrderTerminal = TERMINAL_STATUSES.includes(activeOrder.status);
  const isOpenPaid      = activeOrder.status === 'open_paid';
  const isOrderDone     = currentStatus === 'served' || isOrderTerminal || isOpenPaid;
  const allServed       = allItems.length > 0 && allItems.every(i => i.status === 'served');
  const showPayment     = allServed && !isOrderTerminal && !isOpenPaid;

  // Stepper indices follow STEPPER_KEYS (0..4). The first 4 steps mirror
  // dish progression (worstStatusIndex). The 5th step "Completed" is forced
  // done whenever the order is paid-in-advance or in a terminal completed_*
  // state — even if dishes haven't been served yet.
  const completedStepDone = isOpenPaid || activeOrder.status === 'completed_cash' || activeOrder.status === 'completed_epay';
  // When everything is finished, advance the active step into the Completed slot.
  const activeStep = completedStepDone && (allServed || isOrderTerminal)
    ? STEPPER_KEYS.length - 1
    : worstStatusIndex;

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
          {(() => {
            const name = local(activeOrder, 'restaurantName')
              || (i18n.language === 'en' ? restaurantName_en : restaurantName)
              || restaurantName;
            return name ? (
              <p className={styles.restaurantName}>
                <MdStorefront className={styles.restaurantIcon} />
                {name}
              </p>
            ) : null;
          })()}
          <p className={styles.orderLabel}>{t('order')}</p>
          <p className={styles.orderId}>#{activeOrder.id}</p>
          <p className={styles.tableInfo}>{t('table_number')}{tableNumber}</p>
        </div>

        {/* ── Notifications panel ── */}
        {showNotifs && (
          <div className={styles.notifPanel}>
            <div className={styles.notifPanelHeader}>
              <span>{t('notifications')}</span>
              <button className={styles.notifClose} onClick={() => setShowNotifs(false)}>✕</button>
            </div>
            {notifications.length === 0 ? (
              <p className={styles.notifEmpty}>{t('no_notifications')}</p>
            ) : (
              <ul className={styles.notifList}>
                {notifications.map(n => (
                  <li
                    key={n._id}
                    className={`${styles.notifItem} ${n.readAt ? styles.notifRead : ''}`}
                    onClick={() => markAllRead(activeOrderIdRef.current)}
                  >
                    <span className={styles.notifTitle}>{isEn ? n.title_en : n.title_uk}</span>
                    {(isEn ? n.body_en : n.body_uk) ? (
                      <span className={styles.notifBody}>{isEn ? n.body_en : n.body_uk}</span>
                    ) : null}
                    <span className={styles.notifTime}>
                      {t('notif_sent')} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {n.readAt && (
                      <span className={`${styles.notifTime} ${styles.notifReadTime}`}>
                        {t('notif_read')} {new Date(n.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
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
              <p className={styles.paidBannerTitle}>{t('paid_banner_title')}</p>
              <p className={styles.paidBannerSub}>{t('paid_banner_sub')}</p>
            </div>
          </div>
        )}

        {/* ── Progress tracker ── */}
        <div className={styles.stepsCard}>
          <div className={styles.steps}>
            {stepsLabels.map((stepLabel, i) => {
              // The final "Completed" step is forced done whenever the order
              // is paid-in-advance, even though dishes may still be cooking.
              const isCompletedSlot = i === STEPPER_KEYS.length - 1;
              const forceDone       = isCompletedSlot && completedStepDone;
              const cls =
                forceDone        ? styles.done   :
                i < activeStep   ? styles.done   :
                i === activeStep ? styles.active :
                                   styles.idle;
              const showCheck = forceDone || i < activeStep;
              return (
                <React.Fragment key={STEPPER_KEYS[i]}>
                  <div className={styles.stepItem}>
                    <div className={`${styles.stepCircle} ${cls}`}>
                      {showCheck ? '✓' : i + 1}
                    </div>
                    <span className={`${styles.stepLabel} ${(i <= activeStep || forceDone) ? styles.stepLabelActive : ''}`}>
                      {stepLabel}
                    </span>
                  </div>
                  {i < stepsLabels.length - 1 && (
                    <div className={`${styles.line} ${(i < activeStep || (isCompletedSlot && forceDone)) ? styles.lineDone : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
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

        {/* ── Reviews (completed orders, premium restaurants only) ── */}
        <OrderReviews
          orderId={activeOrder.id}
          restaurantId={activeOrder.restaurantId}
          restaurantPlan={activeOrder.restaurantPlan}
          items={allItems}
          status={activeOrder.status}
        />

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

            {!showPayWarning && !isFree && (
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
            {callCooldownMsg && (
              <div className={styles.callCooldownMsg}>{t('waiter_call_cooldown_msg')}</div>
            )}
            {(callState === 'answered' || callState === 'cooldown') ? (
              <div className={styles.callAnsweredMsg}>
                <MdCheckCircle /> {t('waiter_call_answered')}
              </div>
            ) : callState === 'pending' ? (
              <button className={styles.callPendingBtn} disabled>
                <span className={styles.callSpinner} />
                <span className={styles.callPendingContent}>
                  <span>{t('waiter_call_pending')}</span>
                  <span className={styles.callPendingTimer}>
                    {Math.floor(callElapsed / 60)}:{String(callElapsed % 60).padStart(2, '0')}
                  </span>
                </span>
              </button>
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
