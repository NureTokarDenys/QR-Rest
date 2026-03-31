import React from 'react';
import styles from './reviewItem.module.css';

export default function ReviewItem({ author, rating, text }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.author}>{author}</span>
        <span className={styles.stars}>{'⭐'.repeat(rating)}</span>
        <span className={styles.ratingText}>{rating}/5</span>
      </div>
      <p className={styles.text}>{text}</p>
    </div>
  );
}