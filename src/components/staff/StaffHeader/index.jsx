import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffLayout } from '../../../context/StaffLayoutContext';
import { NOTIFICATIONS } from '../../../data/mockData';
import styles from './staffHeader.module.css';

import { MdNotifications } from "react-icons/md";
import { MdAccessTime } from "react-icons/md";

export default function StaffHeader({ title, backTo, rightActions }) {
  const navigate = useNavigate();
  const { panelOpen, togglePanel } = useStaffLayout();
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const unread = NOTIFICATIONS.length;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {backTo && (
          <button className={styles.back} onClick={() => navigate(backTo)}>←</button>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.right}>
        {rightActions}
        <span className={styles.time}> <MdAccessTime className={styles.timeIcon} /> {time}</span>
        <button
          className={`${styles.bell} ${panelOpen ? styles.bellActive : ''}`}
          onClick={togglePanel}
        >
          <MdNotifications className={styles.bellIcon} />
          {unread > 0 && <span className={styles.badge}>{unread}</span>}
        </button>
      </div>
    </header>
  );
}