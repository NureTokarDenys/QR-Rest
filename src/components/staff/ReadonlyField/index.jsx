import React from 'react';
import styles from './readonlyField.module.css';

export default function ReadonlyField({ label, value }) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.field}>{value}</div>
    </div>
  );
}