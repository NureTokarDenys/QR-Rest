import React from 'react';
import styles from './microStat.module.css';

export default function MicroStat({ label, value, highlight = false }) {
  return (
    <div className={styles.block}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${highlight ? styles.highlight : ''}`}>{value}</span>
    </div>
  );
}