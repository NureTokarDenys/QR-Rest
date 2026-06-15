import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffNotifications } from '../../../context/StaffNotificationsContext';
import { useAuth } from '../../../context/AuthContext';
import { resolveWaiterCall } from '../../../api/orders';
import { useTranslation } from 'react-i18next';
import { MdCheck } from 'react-icons/md';
import styles from './staffNotificationToast.module.css';

const ROLE_SHOW = {
  cook:        ['ORDER_NEW', 'ORDER_ITEMS_ADDED'],
  waiter:      ['WAITER_CALL', 'WAITER_CALL_CASH'],
  waiter_cook: ['ORDER_NEW', 'ORDER_ITEMS_ADDED', 'WAITER_CALL', 'WAITER_CALL_CASH'],
  admin:       ['ORDER_NEW', 'ORDER_ITEMS_ADDED', 'WAITER_CALL', 'WAITER_CALL_CASH'],
};

const CALL_TYPES = new Set(['WAITER_CALL', 'WAITER_CALL_CASH']);

export default function StaffNotificationToast() {
  const { notifications, markRead } = useStaffNotifications();
  const { user } = useAuth();
  const { t } = useTranslation('components');
  const navigate = useNavigate();

  const allowed = ROLE_SHOW[user?.role] ?? [];
  const candidates = notifications.filter(n => allowed.includes(n.type) && !n.readAt);
  const latest = candidates[candidates.length - 1] ?? null;

  const [shownId, setShownId]   = useState(null);
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!latest) return;
    if (latest.id !== shownId) {
      setShownId(latest.id);
      setAccepting(false);
      setExiting(false);
      setVisible(true);
    }
  }, [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 60 && dy < 40) dismiss();
    touchStartX.current = null;
  }

  function dismiss() {
    if (latest) markRead(latest.id);
    setExiting(true);
    setTimeout(() => setVisible(false), 280);
  }

  function handleTap() {
    if (!latest) return;
    markRead(latest.id);
    setExiting(true);
    setTimeout(() => setVisible(false), 280);
    if (CALL_TYPES.has(latest.type)) {
      navigate(`/staff/table/${latest.tableNum}`);
    } else {
      navigate('/staff/cooking');
    }
  }

  async function handleAccept(e) {
    e.stopPropagation();
    if (!latest || accepting) return;
    setAccepting(true);
    markRead(latest.id);
    if (latest.callId) {
      try { await resolveWaiterCall(latest.callId); } catch { /* navigate anyway */ }
    }
    setExiting(true);
    setTimeout(() => setVisible(false), 280);
    navigate(`/staff/table/${latest.tableNum}`);
  }

  if (!visible || !latest) return null;

  const isCall = CALL_TYPES.has(latest.type);
  const isCash = latest.type === 'WAITER_CALL_CASH';

  return (
    <div
      className={`${styles.toast} ${isCash ? styles.cash : isCall ? styles.call : styles.order} ${exiting ? styles.exit : styles.enter}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={handleTap}
      role="status"
      aria-live="polite"
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.inner}>
        <span className={styles.dot} />
        <p className={styles.title}>{latest.title}</p>
        {isCall && (
          <button
            className={styles.acceptBtn}
            onClick={handleAccept}
            disabled={accepting}
          >
            <MdCheck size={14} />
            {t('acceptCall')}
          </button>
        )}
        <button
          className={styles.close}
          onClick={e => { e.stopPropagation(); dismiss(); }}
          aria-label="Dismiss"
        >✕</button>
      </div>
    </div>
  );
}
