import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from 'react-i18next';
import styles from './notificationToast.module.css';

export default function NotificationToast() {
  const { notifications, currentOrder, markAllRead } = useApp();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn = i18n.language === 'en';

  const latest = notifications[0] ?? null;
  const [shownId, setShownId]   = useState(null);
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);

  // Show toast only for unread notifications
  useEffect(() => {
    if (!latest) return;
    if (latest._id !== shownId) {
      setShownId(latest._id);
      if (!latest.readAt) {
        setExiting(false);
        setVisible(true);
      }
    }
  }, [latest?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Swipe-to-dismiss
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
    setExiting(true);
    setTimeout(() => setVisible(false), 280);
  }

  function handleTap() {
    markAllRead();
    dismiss();
    const target = currentOrder?.id
      ? `/order-status/${currentOrder.id}`
      : '/order-status';
    navigate(target, { state: { openNotifs: true } });
  }

  if (!visible || !latest) return null;

  const title = isEn ? latest.title_en : latest.title_uk;
  const body  = isEn ? latest.body_en  : latest.body_uk;

  return (
    <div
      className={`${styles.toast} ${exiting ? styles.exit : styles.enter}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={handleTap}
      role="status"
      aria-live="polite"
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.inner}>
        <span className={styles.dot} />
        <div className={styles.text}>
          {title && <p className={styles.title}>{title}</p>}
          {body  && <p className={styles.body}>{body}</p>}
        </div>
        <button className={styles.close} onClick={e => { e.stopPropagation(); dismiss(); }} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
