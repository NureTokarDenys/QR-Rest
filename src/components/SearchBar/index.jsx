import React from 'react';
import styles from './searchBar.module.css';

export default function SearchBar({ placeholder, value, onChange }) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon}>🔍</span>
      <input
        className={styles.input}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}