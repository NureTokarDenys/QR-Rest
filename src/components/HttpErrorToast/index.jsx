import { useEffect, useState, useCallback } from 'react';
import styles from './httpErrorToast.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_TITLES = {
  0:   'Network Error',
  400: 'Bad Request',
  403: 'Access Denied',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  422: 'Validation Error',
  429: 'Too Many Requests',
  500: 'Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

function getTitle(status, code) {
  if (STATUS_TITLES[status]) return STATUS_TITLES[status];
  if (status >= 500) return 'Server Error';
  if (status >= 400) return 'Request Error';
  if (status === 0)  return 'Network Error';
  return 'Error';
}

function getSeverity(status) {
  if (status === 0 || status >= 500) return 'critical'; // red
  if (status >= 400) return 'warn';                     // amber
  return 'info';
}

let _nextId = 1;

// ─── Component ────────────────────────────────────────────────────────────────

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
        // Keep only the most recent MAX_VISIBLE toasts
        return next.slice(-MAX_VISIBLE);
      });

      // Auto-dismiss
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
  const { status, code, message } = toast;
  const title    = getTitle(status, code);
  const severity = getSeverity(status);
  const badge    = status > 0 ? String(status) : '!';

  return (
    <div className={`${styles.toast} ${styles[severity]}`}>
      <div className={styles.header}>
        <span className={styles.badge}>{badge}</span>
        <span className={styles.title}>{title}</span>
        <button className={styles.close} onClick={onClose} aria-label="Dismiss">✕</button>
      </div>

      {message && (
        <p className={styles.message}>{message}</p>
      )}

      {code && code !== 'NETWORK_ERROR' && (
        <p className={styles.code}>{code}</p>
      )}

      <div className={styles.progress} style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }} />
    </div>
  );
}
