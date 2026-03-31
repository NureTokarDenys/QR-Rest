import React from 'react';
import styles from './settingsRow.module.css';

export default function SettingsRow({ icon, label, value, onClick, danger = false }) {
  return (
    <button
      className={`${styles.row} ${danger ? styles.danger : ''}`}
      onClick={onClick}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{label}</span>
      {value && <span className={styles.value}>{value}</span>}
      <span className={styles.chevron}>›</span>
    </button>
  );
}