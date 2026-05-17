import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from 'react-i18next';
import styles from './notificationToast.module.css';

export default function NotificationToast() {
  const { notifications } = useApp();
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const latest = notifications[0] ?? null;
  const [shownId, setShownId]   = useState(null);
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);

  // Show toast whenever a new notification arrives
  useEffect(() => {
    if (!latest) return;
    if (latest._id !== shownId) {
      setShownId(latest._id);
      setExiting(false);
      setVisible(true);
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

  if (!visible || !latest) return null;

  const title = isEn ? latest.title_en : latest.title_uk;
  const body  = isEn ? latest.body_en  : latest.body_uk;

  return (
    <div
      className={`${styles.toast} ${exiting ? styles.exit : styles.enter}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="status"
      aria-live="polite"
    >
      <div className={styles.inner}>
        <span className={styles.dot} />
        <div className={styles.text}>
          {title && <p className={styles.title}>{title}</p>}
          {body  && <p className={styles.body}>{body}</p>}
        </div>
        <button className={styles.close} onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
