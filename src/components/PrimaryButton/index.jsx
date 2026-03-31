import React from 'react';
import styles from './primaryButton.module.css';

export default function PrimaryButton({ label, onClick, type = 'button', disabled = false }) {
  return (
    <button
      className={styles.button}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {label}
    </button>
  );
}