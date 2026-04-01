import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import ReviewItem from '../../../components/ReviewItem';
import PrimaryButton from '../../../components/PrimaryButton';
import { getDishById } from '../../../data/mockData';
import styles from './dishDetail.module.css';
import { useToast } from "../../../context/ClientToastContext";
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

export default function DishDetail() {
  const { t: t1 } = useTranslation('clientToast');
  const { t: t2 } = useTranslation('notFound');
  const { t: t3 } = useTranslation('dishDetails');
  
  const local = useLocalField(); 
  const { id } = useParams();
  const navigate = useNavigate();
  const dish = getDishById(id);
  const { addToCart } = useApp();
  const [quantity, setQuantity] = useState(1);

  if (!dish) return <div className={styles.notFound}>{t2('dish_not_found')}</div>;

  const { showToast } = useToast();

  function handleAdd() {
    for (let i = 0; i < quantity; i++) addToCart(dish);
    navigate(-1);
    showToast(`${t1('message_p1')} "${local(dish, 'name')}" ${t1('message_p2')}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.imageWrapper}>
        <img src={dish.image} alt={local(dish, 'name')} className={styles.image} />
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
      </div>

      <div className={styles.content}>
        <h1 className={styles.name}>{local(dish, 'name')}</h1>

        <div className={styles.ratingRow}>
          {[1,2,3,4,5].map(i => (
            <span key={i} className={i <= Math.floor(dish.rating) ? styles.starFilled : styles.starEmpty}>★</span>
          ))}
          <span className={styles.ratingVal}>{dish.rating}</span>
          <span className={styles.reviewCount}>· {dish.reviewCount} {t3('review', { count: dish.reviewCount })}</span>
        </div>

        <p className={styles.description}>{local(dish, 'description')}</p>

        {dish.ingredients && (
          <>
            <h3 className={styles.sectionTitle}>{t3('contents')}</h3>
            <p className={styles.ingredients}>{local(dish, 'ingredients')}</p>
          </>
        )}

        {dish.reviews && dish.reviews.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>{t3('reviews')}</h3>
            <div className={styles.reviews}>
              {dish.reviews.map((r, i) => (
                <ReviewItem key={i} author={r.author} rating={r.rating} text={local(r, 'text')} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.qty}>
          <button className={styles.qtyBtn} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <span className={styles.qtyVal}>{quantity}</span>
          <button className={styles.qtyBtn} onClick={() => setQuantity(q => q + 1)}>+</button>
        </div>
        <div className={styles.addBtn}>
          <PrimaryButton label={`${t3('add')} · ${dish.price * quantity}₴`} onClick={handleAdd} />
        </div>
      </div>
    </div>
  );
}