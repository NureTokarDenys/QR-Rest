import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './footer.module.css';
import { useTranslation } from 'react-i18next';

import { MdOutlineRestaurant } from "react-icons/md";
import { MdShoppingCart } from "react-icons/md";
import { MdPerson } from "react-icons/md";

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('footer'); 

  const tabs = [
    { path: '/menu', label: t('menu'), icon: <MdOutlineRestaurant /> },
    { path: '/cart', label: t('cart'), icon: <MdShoppingCart /> },
    { path: '/profile', label: t('profile'), icon: <MdPerson /> },
  ];

  return (
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
  );
}