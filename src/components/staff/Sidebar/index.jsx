import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../Logo';
import { useAuth } from '../../../context/AuthContext';
import styles from './sidebar.module.css';

import { MdMap, MdLocalFireDepartment, MdRestaurant, MdBarChart, MdSettings } from "react-icons/md";

const NAV = [
  { path: '/staff/map',       icon: <MdMap />,               labelKey: 'nav_tableMap' },
  { path: '/staff/cooking',   icon: <MdLocalFireDepartment />, labelKey: 'nav_cooking' },
  { path: '/staff/menu',      icon: <MdRestaurant />,        labelKey: 'nav_menu' },
  { path: '/staff/analytics', icon: <MdBarChart />,          labelKey: 'nav_analytics' },
  { path: '/staff/settings',  icon: <MdSettings />,          labelKey: 'nav_settings' },
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('components');
  const { user } = useAuth();

  const isAdmin  = user?.role === 'admin';
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const roleName = isAdmin ? t('role_admin') : t('role_waiter');

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarMobileOpen : ''}`}>
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
              onClick={() => { navigate(item.path); onClose(); }}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{t(item.labelKey)}</span>
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
