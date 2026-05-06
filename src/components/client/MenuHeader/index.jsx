import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { getRestaurantReviews } from '../../../api/reviews';
import { useTranslation } from 'react-i18next';
import styles from './menuHeader.module.css';

/**
 * Sticky header for the client menu pages.
 *
 * Left  — Waitless logo
 * Right — table / restaurant-name chip  +  rating badge (⭐ 4.2 · 12)
 *
 * Tapping the rating badge navigates to /restaurant-reviews.
 * The summary is fetched once on mount; missing rating shows nothing.
 */
export default function MenuHeader() {
  const navigate = useNavigate();
  const { t } = useTranslation('menu');
  const { t: tR } = useTranslation('restaurantReviews');
  const { restaurantId, restaurantName, tableNumber } = useApp();

  const [summary, setSummary] = useState(null); // { averageRating, totalCount }

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    getRestaurantReviews(restaurantId, 1, 1)
      .then(envelope => {
        if (!cancelled && envelope?.summary) setSummary(envelope.summary);
      })
      .catch(() => {}); // silently ignore — rating is non-critical
    return () => { cancelled = true; };
  }, [restaurantId]);

  const contextLabel = tableNumber
    ? t('table', { number: tableNumber })
    : restaurantName || null;

  const showRating = summary && summary.totalCount > 0;

  return (
    <header className={styles.header}>
      {/* Logo */}
      <button className={styles.logo} onClick={() => navigate('/menu')}>
        <span className={styles.logoWait}>Wait</span>
        <span className={styles.logoLess}>less</span>
      </button>

      <div className={styles.right}>
        {contextLabel && (
          <span className={styles.contextChip}>{contextLabel}</span>
        )}

        {showRating && (
          <button
            className={styles.ratingBadge}
            onClick={() => navigate('/restaurant-reviews')}
            aria-label={tR('rating_aria', { rating: summary.averageRating.toFixed(1) })}
          >
            <span className={styles.ratingStar}>★</span>
            <span className={styles.ratingValue}>{summary.averageRating.toFixed(1)}</span>
            <span className={styles.ratingCount}>· {summary.totalCount}</span>
          </button>
        )}
      </div>
    </header>
  );
}
