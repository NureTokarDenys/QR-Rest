import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import Header from '../../../components/client/Header';
import ReviewItem from '../../../components/client/ReviewItem';
import Footer from '../../../components/client/Footer';
import { getRestaurantReviews } from '../../../api/reviews';
import { useTranslation } from 'react-i18next';
import styles from './restaurantReviews.module.css';

// ─── Star summary bar ─────────────────────────────────────────────────────────

function StarBar({ star, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{star}★</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.barPct}>{pct}%</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RestaurantReviews() {
  const navigate = useNavigate();
  const { t } = useTranslation('restaurantReviews');
  const { restaurantId, restaurantName } = useApp();

  const [reviews, setReviews]       = useState([]);
  const [summary, setSummary]       = useState(null);  // { averageRating, totalCount }
  const [distribution, setDist]     = useState({});    // { 5: n, 4: n, ... }
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (pageNum, replace = false) => {
    if (!restaurantId) return;
    pageNum === 1 ? setLoading(true) : setLoadingMore(true);

    try {
      const envelope = await getRestaurantReviews(restaurantId, pageNum, 15);
      const { data = [], pagination, summary: s } = envelope;

      if (replace) {
        setReviews(data);
      } else {
        setReviews(prev => [...prev, ...data]);
      }

      setSummary(s);
      setHasMore(pagination.page < pagination.pages);

      // Compute distribution from the current full list (only on first page load)
      if (replace) {
        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        data.forEach(r => { if (dist[r.rating] !== undefined) dist[r.rating]++; });
        setDist(dist);
      }
    } catch {
      // HttpErrorToast already surfaced the error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    setPage(1);
    load(1, true);
  }, [load]);

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    load(next, false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const title = restaurantName ? `${restaurantName} — Reviews` : 'Restaurant Reviews';

  if (!restaurantId) {
    return (
      <div className={styles.page}>
        <Header title={t('title')} showBack />
        <p className={styles.empty}>{t('no_restaurant')}</p>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header
        title={restaurantName ? t('title_for', { name: restaurantName }) : t('title')}
        showBack
      />

      <div className={styles.content}>

        {/* ── Summary hero ── */}
        {summary && (
          <div className={styles.hero}>
            <div className={styles.heroScore}>
              <span className={styles.heroRating}>{summary.averageRating.toFixed(1)}</span>
              <span className={styles.heroStars}>
                {[1, 2, 3, 4, 5].map(i => (
                  <span
                    key={i}
                    className={i <= Math.round(summary.averageRating)
                      ? styles.starFilled : styles.starEmpty}
                  >★</span>
                ))}
              </span>
              <span className={styles.heroCount}>
                {t('review', { count: summary.totalCount })}
              </span>
            </div>

            {summary.totalCount > 0 && (
              <div className={styles.barBlock}>
                {[5, 4, 3, 2, 1].map(star => (
                  <StarBar
                    key={star}
                    star={star}
                    count={distribution[star] || 0}
                    total={summary.totalCount}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Review list ── */}
        {loading && <p className={styles.empty}>{t('loading')}</p>}

        {!loading && reviews.length === 0 && (
          <p className={styles.empty}>{t('empty')}</p>
        )}

        {reviews.length > 0 && (
          <div className={styles.list}>
            {reviews.map(r => (
              <ReviewItem
                key={r._id}
                author={r.userId?.name || t('anonymous')}
                rating={r.rating}
                text={r.comment || ''}
                date={r.createdAt}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <button
            className={styles.loadMore}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? t('loading_more') : t('load_more')}
          </button>
        )}
      </div>

      <Footer />
    </div>
  );
}
