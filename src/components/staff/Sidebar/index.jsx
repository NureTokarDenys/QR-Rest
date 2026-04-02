import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../Logo';
import { STAFF_USER } from '../../../data/mockData';
import styles from './sidebar.module.css';

const NAV = [
  { path: '/staff/map',       icon: '🗺',  labelKey: 'tableMap' },
  { path: '/staff/cooking',   icon: '🍳',  labelKey: 'cooking' },
  { path: '/staff/menu',      icon: '🍽',  labelKey: 'menu' },
  { path: '/staff/analytics', icon: '📊',  labelKey: 'analytics' },
  { path: '/staff/settings',  icon: '⚙️', labelKey: 'settings' },
];

const LABEL_MAP = {
  tableMap:  { ua: 'Карта залу',  en: 'Table Map' },
  cooking:   { ua: 'Приготування', en: 'Cooking' },
  menu:      { ua: 'Меню',        en: 'Menu' },
  analytics: { ua: 'Аналітика',   en: 'Analytics' },
  settings:  { ua: 'Налаштування', en: 'Settings' },
};

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ua';

  const isAdmin = STAFF_USER.role === 'admin';
  const initials = STAFF_USER.initials;
  const roleName = isAdmin
    ? (lang === 'en' ? 'Administrator' : 'Адміністратор')
    : (lang === 'en' ? 'Waiter' : 'Офіціант');

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoWrap}>
        <Logo compact />
      </div>

      <nav className={styles.nav}>
        {NAV.map(item => {
          const active = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              className={`${styles.navItem} ${active ? styles.active : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{LABEL_MAP[item.labelKey][lang]}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.user}>
        <div className={styles.avatar}>{initials}</div>
        <span className={styles.roleName}>{roleName}</span>
      </div>
    </aside>
  );
}