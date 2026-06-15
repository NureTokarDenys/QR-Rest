import React from 'react';
import styles from './pdfSettingItem.module.css';

export default function PdfSettingItem({ label, children }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.control}>{children}</div>
    </div>
  );
}