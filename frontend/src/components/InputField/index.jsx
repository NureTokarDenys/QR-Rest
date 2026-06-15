import React, { useState } from 'react';
import styles from './inputField.module.css';

export default function InputField({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  error,      // optional field-level error string
  ...rest     // onKeyDown, onBlur, id, autoComplete, etc.
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        <input
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          type={isPassword && !showPassword ? 'password' : 'text'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          {...rest}
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
      {error && <p className={styles.fieldError}>{error}</p>}
    </div>
  );
}
