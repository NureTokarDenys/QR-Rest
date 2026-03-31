import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './categoryCard.module.css';

const getDishWord = (count) => {
  if (count % 10 === 1 && count % 100 !== 11) return 'страва';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'страви';
  return 'страв';
};

export default function CategoryCard({ id, name, count, image }) {
  const navigate = useNavigate();

  return (
    <div className={styles.card} onClick={() => navigate(`/category/${id}`)}>
      <img src={image} alt={name} className={styles.image} />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <span className={styles.name}>{name}</span>
        <span className={styles.count}>
          {count} {getDishWord(count)}
        </span>
      </div>
    </div>
  );
}