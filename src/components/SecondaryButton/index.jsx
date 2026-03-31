import React from 'react';
import styles from './secondaryButton.module.css';

export default function SecondaryButton({ label, onClick, type = 'button' }) {
  return (
    <button className={styles.button} onClick={onClick} type={type}>
      {label}
    </button>
  );
}