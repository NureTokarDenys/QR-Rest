import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './header.module.css';

export default function Header({ title, showBack = false, rightElement }) {
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack && (
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            ←
          </button>
        )}
      </div>
      <span className={styles.title}>{title}</span>
      <div className={styles.right}>{rightElement}</div>
    </header>
  );
}