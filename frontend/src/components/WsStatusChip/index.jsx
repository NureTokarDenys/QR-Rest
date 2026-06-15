import { useState, useLayoutEffect, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './wsStatusChip.module.css';

const POPUP_W = 220;

function useConfig(t) {
  return {
    connected:    { color: '#22c55e', label: t('ws_online_label'),       desc: t('ws_online_desc') },
    reconnecting: { color: '#f59e0b', label: t('ws_reconnecting_label'), desc: t('ws_reconnecting_desc') },
    connecting:   { color: '#f59e0b', label: t('ws_reconnecting_label'), desc: t('ws_connecting_desc') },
    failed:       { color: '#ef4444', label: t('ws_offline_label'),       desc: t('ws_offline_desc') },
  };
}

export default function WsStatusChip({ status = 'idle', latency = null, compact = false, preferTop = false }) {
  const { t } = useTranslation('components');
  const config = useConfig(t);
  const cfg = config[status];

  const [open, setOpen]             = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const ref = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) close();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - POPUP_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));
    if (preferTop) {
      setPopupStyle({ left, bottom: window.innerHeight - rect.top + 8 });
    } else {
      setPopupStyle({ left, top: rect.bottom + 8 });
    }
  }, [open, preferTop]);

  if (!cfg) return null;

  const pulsing = status === 'connecting' || status === 'reconnecting';

  return (
    <div ref={ref} className={styles.wrap} data-compact={compact || undefined}>
      <button
        className={styles.chip}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        aria-label={`Connection status: ${cfg.label}`}
      >
        <span
          className={`${styles.dot} ${pulsing ? styles.dotPulse : ''}`}
          style={{ background: cfg.color }}
        />
        <span className={styles.label} style={{ color: cfg.color }}>{cfg.label}</span>
      </button>

      {open && (
        <div className={styles.popup} style={popupStyle}>
          <div className={styles.popupRow}>
            <span className={styles.popupDot} style={{ background: cfg.color }} />
            <span className={styles.popupStatus}>{cfg.label}</span>
          </div>
          <p className={styles.popupDesc}>{cfg.desc}</p>
          {latency !== null && status === 'connected' && (
            <div className={styles.popupLatency}>
              <span className={styles.popupLatencyLabel}>{t('ws_ping')}</span>
              <span className={styles.popupLatencyVal}>{latency} ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
