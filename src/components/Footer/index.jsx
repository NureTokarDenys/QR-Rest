import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './footer.module.css';

import { MdOutlineRestaurant } from "react-icons/md";
import { MdShoppingCart } from "react-icons/md";
import { MdPerson } from "react-icons/md";

const tabs = [
  { path: '/menu', label: 'Меню', icon: <MdOutlineRestaurant /> },
  { path: '/cart', label: 'Кошик', icon: <MdShoppingCart /> },
  { path: '/profile', label: 'Профіль', icon: <MdPerson /> },
];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

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