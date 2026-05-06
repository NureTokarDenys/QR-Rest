import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './footer.module.css';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../../context/AppContext';

import { MdOutlineRestaurant } from "react-icons/md";
import { MdShoppingCart } from "react-icons/md";
import { MdPerson } from "react-icons/md";
import { MdReceipt } from "react-icons/md";

const STATUS_RANK = { waiting: 0, cooking: 1, ready: 2, served: 3 };

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('footer');
  const { currentOrder } = useApp();

  const tabs = [
    { path: '/menu',    label: t('menu'),    icon: <MdOutlineRestaurant /> },
    { path: '/cart',    label: t('cart'),    icon: <MdShoppingCart /> },
    { path: '/profile', label: t('profile'), icon: <MdPerson /> },
  ];

  // Determine whether the FAB should be visible:
  // – there must be an active order with at least one unserved item
  // – we're not already viewing that specific order's status page
  const activeOrderPath = currentOrder?.id ? `/order-status/${currentOrder.id}` : null;
  const onActiveOrderPage = activeOrderPath
    ? location.pathname === activeOrderPath
    : location.pathname === '/order-status';
  const hasUnservedItems = currentOrder?.items?.some(
    item => (STATUS_RANK[item.status] ?? 0) < STATUS_RANK.served
  );
  const showFab = !!currentOrder && hasUnservedItems && !onActiveOrderPage;

  const itemCount = currentOrder?.items?.reduce((s, i) => s + (i.quantity ?? 1), 0) ?? 0;

  return (
    <>
      {showFab && (
        <button
          className={styles.fab}
          onClick={() => navigate(activeOrderPath || '/order-status')}
          aria-label="View active order"
        >
          <MdReceipt className={styles.fabIcon} />
          {itemCount > 0 && (
            <span className={styles.fabBadge}>{itemCount}</span>
          )}
        </button>
      )}

      <footer className={styles.footer}>
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(tab.path)}
            >
              <span className={styles.icon}>{tab.icon}</span>
              <span className={styles.label}>{tab.label}</span>
            </button>
          );
        })}
      </footer>
    </>
  );
}