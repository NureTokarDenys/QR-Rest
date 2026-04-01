import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import styles from './dishCard.module.css';
import { useToast } from "../../context/ClientToastContext";
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../i18n/useLang';

export default function DishCard({ dish }) {
  const { t } = useTranslation('clientToast');
  const local = useLocalField(); 
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const { showToast } = useToast();
  
  function handleAdd(e) {
    e.stopPropagation();
    addToCart(dish);
    showToast(`${t('message_p1')} "${local(dish, 'name')}" ${t('message_p2')}`);
  }

  return (
    <div className={styles.card} onClick={() => navigate(`/dish/${dish.id}`)}>
      <img src={dish.image} alt={dish.name} className={styles.image} />
      <div className={styles.body}>
        <span className={styles.name}>{local(dish, 'name')}</span>
        <div className={styles.rating}>
          <span className={styles.star}>⭐</span>
          <span className={styles.ratingValue}>{dish.rating}</span>
        </div>
        <div className={styles.bottom}>
          <span className={styles.price}>{dish.price}₴</span>
          <button className={styles.addButton} onClick={handleAdd}>+</button>
        </div>
      </div>
    </div>
  );
}