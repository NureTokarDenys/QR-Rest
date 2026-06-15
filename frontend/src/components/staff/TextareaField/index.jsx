import React from 'react';
import styles from './textareaField.module.css';

export default function TextareaField({ label, placeholder, value, onChange, rows = 3 }) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <textarea
        className={styles.textarea}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
      />
    </div>
  );
}