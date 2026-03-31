import React from 'react';
import styles from './logo.module.css';
import logo from "../../assets/logo.png";

export default function Logo() {
  return (
    <div className={styles.wrapper}>
      <img src={logo} alt="Waitless logo" className={styles.icon} />
      <div className={styles.wordmark}>
        <span className={styles.wait}>Wait</span>
        <span className={styles.less}>less</span>
      </div>
    </div>
  );
}