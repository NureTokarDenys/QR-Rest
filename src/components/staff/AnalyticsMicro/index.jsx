import React from 'react';
import styles from './analyticsMicro.module.css';

export default function AnalyticsMicro({ label, value, change, changeUp }) {
  return (
    <div className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {change !== undefined && (
        <p className={`${styles.change} ${changeUp ? styles.up : styles.down}`}>
          {changeUp ? '↑' : '↓'} +{Math.abs(change)}% вчора
        </p>
      )}
    </div>
  );
}