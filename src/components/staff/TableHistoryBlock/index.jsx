import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './tableHistoryBlock.module.css';

// Maps order status → translation key and CSS class
const STATUS_MAP = {
  waiting:         { key: 'historyStatusWaiting',   cls: 'active'    },
  cooking:         { key: 'historyStatusCooking',   cls: 'active'    },
  ready:           { key: 'historyStatusReady',     cls: 'active'    },
  served:          { key: 'historyStatusServed',    cls: 'active'    },
  payment_pending: { key: 'historyStatusPayment',   cls: 'active'    },
  completed:       { key: 'historyStatusCompleted', cls: 'completed' },
  void:            { key: 'historyStatusVoid',      cls: 'void'      },
};

export default function TableHistoryBlock({ history = [] }) {
  const { t }    = useTranslation('tableDetail');
  const navigate = useNavigate();

  function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1)  return t('timeAgoLess1');
    if (diff < 60) return t('timeAgoMinAgo',  { n: diff });
    const h = Math.floor(diff / 60);
    if (h < 24)    return t('timeAgoHourAgo', { n: h });
    return             t('timeAgoDayAgo',  { n: Math.floor(h / 24) });
  }

  return (
    <div className={styles.box}>
      <p className={styles.title}>{t('history')}</p>

      {history.length === 0 && (
        <p className={styles.empty}>{t('historyEmpty')}</p>
      )}

      {history.map(h => {
        const cfg = STATUS_MAP[h.status] || { key: null, cls: 'active' };
        const label = cfg.key ? t(cfg.key) : h.status;
        return (
          <div key={h._id} className={styles.row}>
            <button
              className={styles.id}
              onClick={() => navigate(`/staff/order/${h._id}`)}
            >
              #{h._id}
            </button>

            <span className={`${styles.statusBadge} ${styles[cfg.cls]}`}>
              {label}
            </span>

            <div className={styles.meta}>
              <span className={styles.total}>
                {h.totalAmount != null ? `${h.totalAmount.toFixed(0)}₴` : '—'}
              </span>
              <span className={styles.time}>{timeAgo(h.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
