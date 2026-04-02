import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './tableHistoryBlock.module.css';

export default function TableHistoryBlock({ history }) {
  const { t } = useTranslation('tableDetail');
  const navigate = useNavigate();

  return (
    <div className={styles.box}>
      <p className={styles.title}>{t('history')}</p>
      {history.map((h, i) => (
        <div key={i} className={styles.row}>
          <button
            className={styles.id}
            onClick={() => navigate(`/staff/order/${h.id}`)}
          >
            #{h.id}
          </button>
          <span className={styles.total}>{h.total}₴</span>
        </div>
      ))}
    </div>
  );
}