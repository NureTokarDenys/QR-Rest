import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffLayout } from '../../../context/StaffLayoutContext';
import { useStaffNotifications } from '../../../context/StaffNotificationsContext';
import styles from './staffHeader.module.css';

import { MdNotifications, MdAccessTime, MdMenu } from 'react-icons/md';

export default function StaffHeader({ title, backTo, rightActions, onMenuToggle }) {
  const navigate = useNavigate();
  const { panelOpen, togglePanel } = useStaffLayout();
  const { unreadCount } = useStaffNotifications();
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

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.hamburger} onClick={onMenuToggle} aria-label="Menu">
          <MdMenu />
        </button>
        {backTo && (
          <button className={styles.back} onClick={() => navigate(backTo)}>←</button>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.right}>
        {rightActions}
        <span className={styles.time}><MdAccessTime className={styles.timeIcon} /> {time}</span>
        <button
          className={`${styles.bell} ${panelOpen ? styles.bellActive : ''}`}
          onClick={togglePanel}
        >
          <MdNotifications className={styles.bellIcon} />
          {unreadCount > 0 && (
            <span className={`${styles.badge} ${styles.badgePulse}`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
