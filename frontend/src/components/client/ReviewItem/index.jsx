import React from 'react';
import styles from './reviewItem.module.css';

export default function ReviewItem({ author, rating, text, date }) {
  const formatted = date
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
    : null;

  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <div className={styles.meta}>
          <span className={styles.author}>{author}</span>
          {formatted && <span className={styles.date}>{formatted}</span>}
        </div>
        <div className={styles.stars}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} className={i <= rating ? styles.starFilled : styles.starEmpty}>★</span>
          ))}
        </div>
      </div>
      {text ? <p className={styles.text}>{text}</p> : null}
    </div>
  );
}
