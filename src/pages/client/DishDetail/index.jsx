import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import ReviewItem from '../../../components/ReviewItem';
import PrimaryButton from '../../../components/PrimaryButton';
import { getDishById } from '../../../data/mockData';
import styles from './dishDetail.module.css';
import { useToast } from "../../../context/ClientToastContext";

export default function DishDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dish = getDishById(id);
  const { addToCart } = useApp();
  const [quantity, setQuantity] = useState(1);

  if (!dish) return <div className={styles.notFound}>Страву не знайдено</div>;

  const { showToast } = useToast();

  function handleAdd() {
    for (let i = 0; i < quantity; i++) addToCart(dish);
    navigate(-1);
    showToast(`Додано "${dish.name}" в кошик`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.imageWrapper}>
        <img src={dish.image} alt={dish.name} className={styles.image} />
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
      </div>

      <div className={styles.content}>
        <h1 className={styles.name}>{dish.name}</h1>

        <div className={styles.ratingRow}>
          {[1,2,3,4,5].map(i => (
            <span key={i} className={i <= Math.floor(dish.rating) ? styles.starFilled : styles.starEmpty}>★</span>
          ))}
          <span className={styles.ratingVal}>{dish.rating}</span>
          <span className={styles.reviewCount}>· {dish.reviewCount} відгуків</span>
        </div>

        <p className={styles.description}>{dish.description}</p>

        {dish.ingredients && (
          <>
            <h3 className={styles.sectionTitle}>Склад</h3>
            <p className={styles.ingredients}>{dish.ingredients}</p>
          </>
        )}

        {dish.reviews && dish.reviews.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>Відгуки</h3>
            <div className={styles.reviews}>
              {dish.reviews.map((r, i) => (
                <ReviewItem key={i} author={r.author} rating={r.rating} text={r.text} />
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
          <PrimaryButton label={`Додати · ${dish.price * quantity}₴`} onClick={handleAdd} />
        </div>
      </div>
    </div>
  );
}