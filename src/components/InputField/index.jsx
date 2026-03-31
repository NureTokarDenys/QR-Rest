import React, { useState } from 'react';
import styles from './inputField.module.css';

export default function InputField({ label, placeholder, type = 'text', value, onChange }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        <input
          className={styles.input}
          type={isPassword && !showPassword ? 'password' : 'text'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setShowPassword(p => !p)}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        )}
      </div>
    </div>
  );
}