import React from 'react';
import styles from './logo.module.css';
import logo from '../../assets/logo.png';

export default function Logo({ compact = false }) {
  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''}`}>
      <img src={logo} alt="Waitless logo" className={styles.icon} />
      {!compact && (
        <div className={styles.wordmark}>
          <span className={styles.wait}>Wait</span>
          <span className={styles.less}>less</span>
        </div>
      )}
      {compact && (
        <div className={styles.wordmarkInline}>
          <span className={styles.wait}>Wait</span>
          <span className={styles.lessWhite}>less</span>
        </div>
      )}
    </div>
  );
}