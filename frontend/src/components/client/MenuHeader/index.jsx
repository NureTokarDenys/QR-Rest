import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { getRestaurantReviews } from '../../../api/reviews';
import { getRestaurants } from '../../../api/restaurants';
import { useTranslation } from 'react-i18next';
import { useLocalField, useLang } from '../../../i18n/useLang';
import styles from './menuHeader.module.css';

// Module-level cache — survives navigation between Menu and Category pages.
const reviewCache = { id: null, summary: null };

/**
 * Universal sticky header for all client menu pages.
 *
 * Default (Menu page):
 *   Left  — Waitless logo
 *   Right — table / restaurant-name chip  +  rating badge
 *
 * With showBack + title (Category page):
 *   Left   — ← back button
 *   Center — category title
 *   Right  — table / restaurant-name chip  +  rating badge
 */
export default function MenuHeader({ title, showBack = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation('menu');
  const { t: tR } = useTranslation('restaurantReviews');
  const local = useLocalField();
  const lang = useLang();
  const { restaurantId, restaurantName, restaurantName_en, tableNumber, setRestaurantMeta } = useApp();

  const [summary, setSummary] = useState(
    reviewCache.id === restaurantId ? reviewCache.summary : null
  );

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    getRestaurants()
      .then(list => {
        if (cancelled) return;
        const r = list.find(item =>
          (item.publicId || item._id || item.id) === restaurantId
        );
        if (r?.name) setRestaurantMeta({ name: r.name, nameLang: lang });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [restaurantId, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restaurantId) return;
    if (reviewCache.id === restaurantId && reviewCache.summary) return;
    let cancelled = false;
    getRestaurantReviews(restaurantId, 1, 1)
      .then(envelope => {
        if (cancelled || !envelope?.summary) return;
        reviewCache.id      = restaurantId;
        reviewCache.summary = envelope.summary;
        setSummary(envelope.summary);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [restaurantId]);

  const localRestaurantName = local(
    { name: restaurantName, name_en: restaurantName_en },
    'name'
  ) || restaurantName;

  const contextLabel = tableNumber
    ? t('table', { number: tableNumber })
    : localRestaurantName || null;

  const showRating = summary && summary.totalCount > 0;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack ? (
          <button className={styles.backButton} onClick={() => navigate(-1)}>←</button>
        ) : (
          <button className={styles.logo} onClick={() => navigate('/menu')}>
            <span className={styles.logoWait}>Wait</span>
            <span className={styles.logoLess}>less</span>
          </button>
        )}
      </div>

      {title && (
        <span className={styles.title}>{title}</span>
      )}

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
