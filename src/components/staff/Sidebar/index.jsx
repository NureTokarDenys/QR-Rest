import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../Logo';
import { useAuth } from '../../../context/AuthContext';
import styles from './sidebar.module.css';

import {
  MdMap, MdLocalFireDepartment, MdRestaurant, MdBarChart, MdSettings,
  MdReceiptLong, MdTune, MdPeople, MdRateReview, MdStorefront,
} from 'react-icons/md';

const ALL_NAV = {
  map:        { path: '/staff/map',                 icon: <MdMap />,                labelKey: 'nav_tableMap' },
  orders:     { path: '/staff/orders',              icon: <MdReceiptLong />,         labelKey: 'nav_orders' },
  cooking:    { path: '/staff/cooking',             icon: <MdLocalFireDepartment />, labelKey: 'nav_cooking' },
  menu:       { path: '/staff/menu',                icon: <MdRestaurant />,          labelKey: 'nav_menu' },
  extras:     { path: '/staff/extras',              icon: <MdTune />,                labelKey: 'nav_extras' },
  analytics:  { path: '/staff/analytics',           icon: <MdBarChart />,            labelKey: 'nav_analytics' },
  staff:      { path: '/staff/staff',               icon: <MdPeople />,              labelKey: 'nav_staff' },
  reviews:    { path: '/staff/reviews',             icon: <MdRateReview />,          labelKey: 'nav_reviews' },
  restaurant: { path: '/staff/restaurant-settings', icon: <MdStorefront />,          labelKey: 'nav_restaurant' },
};

const NAV_BY_ROLE = {
  admin:       ['map', 'orders', 'cooking', 'menu', 'extras', 'analytics', 'staff', 'reviews', 'restaurant'],
  waiter:      ['map', 'orders'],
  cook:        ['cooking'],
  waiter_cook: ['map', 'orders', 'cooking'],
};

function getRoleName(role, t) {
  if (role === 'admin')       return t('role_admin');
  if (role === 'waiter')      return t('role_waiter');
  if (role === 'cook')        return t('role_cook');
  if (role === 'waiter_cook') return t('role_waiter_cook');
  return role ?? '';
}

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('components');
  const { user } = useAuth();

  const role     = user?.role ?? 'waiter';
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const roleName = getRoleName(role, t);

  const navKeys  = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.waiter;
  const navItems = navKeys.map(k => ALL_NAV[k]);

  function goTo(path) {
    navigate(path);
    onClose();
  }

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarMobileOpen : ''}`}>
      <div className={styles.logoWrap}>
        <Logo compact />
      </div>

      <nav className={styles.nav}>
        {navItems.map(item => {
          const active = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              className={`${styles.navItem} ${active ? styles.active : ''}`}
              onClick={() => goTo(item.path)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <button
        className={`${styles.user} ${styles.userBtn}`}
        onClick={() => goTo('/staff/settings')}
        title={t('nav_profile')}
      >
        <div className={styles.avatar}>{initials}</div>
        <span className={styles.roleName}>{roleName}</span>
      </button>
    </aside>
  );
}
