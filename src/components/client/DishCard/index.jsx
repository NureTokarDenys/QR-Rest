import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import styles from './dishCard.module.css';
import { useToast } from "../../../context/ClientToastContext";
import { useTranslation } from 'react-i18next';
import { useLocalField, useFallbackField } from '../../../i18n/useLang';
import FallbackMark from '../../FallbackMark';

export default function DishCard({ dish }) {
  const { t } = useTranslation('clientToast');
  const { t: tMenu } = useTranslation('menu');
  const local = useLocalField();
  const fb = useFallbackField();
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const { showToast } = useToast();

  const { value: dishName, isFallback: nameFallback } = fb(dish, 'name');

  function handleAdd(e) {
    e.stopPropagation();
    addToCart(dish);
    showToast(
      `${t('message_p1')} "${local(dish, 'name')}" ${t('message_p2')}`,
      { onClick: () => navigate('/cart') },
    );
  }

  return (
    <div className={styles.card} onClick={() => navigate(`/dish/${dish.id}`)}>
      <img src={dish.image} alt={dish.name} className={styles.image} />
      <div className={styles.body}>
        <span className={styles.name}>
          {dishName}
          {nameFallback && <FallbackMark tip={tMenu('fallback_tooltip')} />}
        </span>
        {dish.rating != null && (
          <div className={styles.rating}>
            <span className={styles.star}>⭐</span>
            <span className={styles.ratingValue}>
              {dish.rating.toFixed(1)}
              {dish.reviewCount > 0 && (
                <span className={styles.reviewCount}> · {dish.reviewCount}</span>
              )}
            </span>
          </div>
        )}
        <div className={styles.bottom}>
          <span className={styles.price}>{dish.price}₴</span>
          <button className={styles.addButton} onClick={handleAdd}>+</button>
        </div>
      </div>
    </div>
  );
}