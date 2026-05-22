import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './httpErrorToast.module.css';

function getSeverity(status) {
  if (status === 0 || status >= 500) return 'critical';
  if (status >= 400) return 'warn';
  return 'info';
}

let _nextId = 1;

const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE     = 3;

export default function HttpErrorToast() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    function handler(e) {
      const { status, code, message } = e.detail;
      const id = _nextId++;

      setToasts(prev => {
        const next = [...prev, { id, status, code, message }];
        return next.slice(-MAX_VISIBLE);
      });

      setTimeout(() => remove(id), AUTO_DISMISS_MS);
    }

    window.addEventListener('api:error', handler);
    return () => window.removeEventListener('api:error', handler);
  }, [remove]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack} role="alert" aria-live="assertive">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onClose }) {
  const { t } = useTranslation('errors');
  const { status, code, message } = toast;

  // Title from HTTP status code, with generic fallbacks
  const title = t(`status.${status}`, {
    defaultValue: status >= 500
      ? t('status.5xx')
      : status >= 400
      ? t('status.4xx')
      : status === 0
      ? t('status.0')
      : t('generic'),
  });

  // Description: prefer translated error code, fall back to raw API message, then generic
  const description = code
    ? t(`code.${code}`, { defaultValue: message || t('generic') })
    : (message || t('generic'));

  const severity = getSeverity(status);
  const badge    = status > 0 ? String(status) : '!';

  return (
    <div className={`${styles.toast} ${styles[severity]}`}>
      <div className={styles.header}>
        <span className={styles.badge}>{badge}</span>
        <span className={styles.title}>{title}</span>
        <button className={styles.close} onClick={onClose} aria-label="Dismiss">✕</button>
      </div>

      <p className={styles.message}>{description}</p>

      {code && code !== 'NETWORK_ERROR' && (
        <p className={styles.code}>{code}</p>
      )}

      <div className={styles.progress} style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }} />
    </div>
  );
}
