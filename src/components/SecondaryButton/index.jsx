import React from 'react';
import styles from './secondaryButton.module.css';

export default function SecondaryButton({ label, onClick, type = 'button', className = styles.button, disabled = false }) {
  return (
    <button className={className} onClick={onClick} type={type} disabled={disabled}>
      {label}
    </button>
  );
}