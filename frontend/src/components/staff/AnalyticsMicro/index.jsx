import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './analyticsMicro.module.css';

export default function AnalyticsMicro({ label, value, change, changeUp }) {
  const { t } = useTranslation('components');

  return (
    <div className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {change !== undefined && (
        <p className={`${styles.change} ${changeUp ? styles.up : styles.down}`}>
          {changeUp ? '↑' : '↓'} +{Math.abs(change)}% {t('yesterday')}
        </p>
      )}
    </div>
  );
}