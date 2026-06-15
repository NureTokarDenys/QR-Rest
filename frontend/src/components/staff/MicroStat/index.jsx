import React from 'react';
import styles from './microStat.module.css';

export default function MicroStat({ label, value, highlight = false, action = null }) {
  return (
    <div className={styles.block}>
      <span className={styles.label}>{label}</span>
      <div className={styles.valueRow}>
        <span className={`${styles.value} ${highlight ? styles.highlight : ''}`}>{value}</span>
        {action}
      </div>
    </div>
  );
}