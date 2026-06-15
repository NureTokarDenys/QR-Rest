import React from 'react';
import styles from './searchBar.module.css';
import { MdSearch } from "react-icons/md";

export default function SearchBar({ placeholder, value, onChange }) {
  return (
    <div className={styles.wrapper}>
      <MdSearch className={styles.icon} />
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