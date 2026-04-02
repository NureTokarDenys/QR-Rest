import React from 'react';
import styles from './settingsSection.module.css';

export default function SettingsSection({ title, children }) {
  return (
    <div className={styles.section}>
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.rows}>{children}</div>
    </div>
  );
}