import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './staffPlaceholder.module.css';

export default function StaffPlaceholder() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <span className={styles.icon}>🧑‍🍳</span>
        <h1 className={styles.title}>Панель персоналу</h1>
        <p className={styles.subtitle}>Розробка у процесі...</p>
        <button className={styles.back} onClick={() => navigate('/login')}>
          ← Повернутись до входу
        </button>
      </div>
    </div>
  );
}