import React from 'react';
import styles from './primaryButton.module.css';

export default function PrimaryButton({ label, onClick, type = 'button', disabled = false, className = styles.button }) {
  return (
    <button
      className={className}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {label}
    </button>
  );
}