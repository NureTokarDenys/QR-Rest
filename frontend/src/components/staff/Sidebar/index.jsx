import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../Logo';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import { usePlan } from '../../../hooks/usePlan';
import UpgradeModal from '../../UpgradeModal';
import WsStatusChip from '../../WsStatusChip';
import styles from './sidebar.module.css';

import {
  MdMap, MdLocalFireDepartment, MdRestaurant, MdBarChart, MdSettings,
  MdReceiptLong, MdTune, MdPeople, MdRateReview, MdStorefront, MdLock,
} from 'react-icons/md';

const PREMIUM_ITEMS = new Set(['analytics', 'reviews']);

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
  root_admin:  ['map', 'orders', 'cooking', 'menu', 'extras', 'analytics', 'staff', 'reviews', 'restaurant'],
  admin:       ['map', 'orders', 'cooking', 'menu', 'extras', 'analytics', 'staff', 'reviews', 'restaurant'],
  waiter:      ['map', 'orders'],
  cook:        ['cooking', 'menu', 'extras'],
  waiter_cook: ['map', 'orders', 'cooking', 'menu', 'extras'],
};

function getRoleName(role, t) {
  if (role === 'root_admin')  return t('role_root_admin');
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

  const { wsStatus, wsLatency } = useApp();
  const { isFree } = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const role     = user?.role ?? 'waiter';
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const roleName = getRoleName(role, t);

  const navKeys  = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.waiter;
  // Same two-group layout for both plans:
  //   • top group   = always-available items
  //   • bottom group (below divider) = premium-tier items
  // The only difference between free and premium is the lock icon — on free
  // those bottom items are shown locked; on premium they're just rendered
  // without the lock badge (no relocation, identical order/positions).
  const navItems = navKeys.map(k => ({
    ...ALL_NAV[k],
    key:       k,
    isPremium: PREMIUM_ITEMS.has(k),         // determines POSITION (bottom group)
    locked:    isFree && PREMIUM_ITEMS.has(k), // determines DISPLAY (lock icon)
  }));
  const baseItems    = navItems.filter(i => !i.isPremium);
  const premiumItems = navItems.filter(i =>  i.isPremium);

  function goTo(path) {
    navigate(path);
    onClose();
  }

  function handleNavClick(item, navKey) {
    if (isFree && PREMIUM_ITEMS.has(navKey)) {
      setUpgradeOpen(true);
      return;
    }
    goTo(item.path);
  }

  return (
    <>
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} ns="components" />
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarMobileOpen : ''}`}>
      <div className={styles.logoWrap}>
        <Logo compact />
      </div>

      <nav className={styles.nav}>
        {baseItems.map(item => (
          <button
            key={item.path}
            className={`${styles.navItem} ${location.pathname.startsWith(item.path) ? styles.active : ''}`}
            onClick={() => handleNavClick(item, item.key)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{t(item.labelKey)}</span>
          </button>
        ))}

        {premiumItems.length > 0 && (
          <>
            <div className={styles.navDivider} />
            {premiumItems.map(item => (
              <button
                key={item.path}
                className={[
                  styles.navItem,
                  item.locked ? styles.navItemLocked : '',
                  location.pathname.startsWith(item.path) ? styles.active : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleNavClick(item, item.key)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{t(item.labelKey)}</span>
                {item.locked && <MdLock className={styles.lockIcon} />}
              </button>
            ))}
          </>
        )}
      </nav>

      <div className={styles.user}>
        <button
          className={styles.userBtn}
          onClick={() => goTo('/staff/settings')}
          title={t('nav_profile')}
        >
          <div className={styles.avatar}>{initials}</div>
          <span className={styles.roleName}>{roleName}</span>
        </button>
        <WsStatusChip status={wsStatus} latency={wsLatency} compact preferTop />
      </div>
    </aside>
    </>
  );
}
