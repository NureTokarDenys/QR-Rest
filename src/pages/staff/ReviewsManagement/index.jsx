import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import { Dropdown } from '../../../components/Dropdown';
import { getAdminReviews, getMenuItems } from '../../../api/admin';
import styles from './reviewsManagement.module.css';
import { MdStar, MdStarBorder, MdRateReview } from 'react-icons/md';

const TABS = ['restaurant', 'dish'];

function Stars({ rating, max = 5 }) {
  return (
    <span className={styles.stars}>
      {Array.from({ length: max }, (_, i) =>
        i < rating
          ? <MdStar key={i} className={styles.starFilled} />
          : <MdStarBorder key={i} className={styles.starEmpty} />
      )}
    </span>
  );
}

function ReviewCard({ review, isDish }) {
  const author = review.userId?.name || '—';
  const date   = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString()
    : '';
  const dishName = review.menuItemId?.name || '';

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardLeft}>
          <span className={styles.author}>{author}</span>
          {isDish && dishName && (
            <span className={styles.dishTag}>{dishName}</span>
          )}
        </div>
        <div className={styles.cardRight}>
          <Stars rating={review.rating} />
          <span className={styles.date}>{date}</span>
        </div>
      </div>
      {review.comment && (
        <p className={styles.comment}>{review.comment}</p>
      )}
    </div>
  );
}

export default function ReviewsManagement() {
  const { t } = useTranslation('reviewsManagement');

  const [activeTab,   setActiveTab]   = useState('restaurant');
  const [reviews,     setReviews]     = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [menuItems,   setMenuItems]   = useState([]);
  const [dishFilter,  setDishFilter]  = useState('');

  // Load menu items for dish filter dropdown
  useEffect(() => {
    if (activeTab === 'dish') {
      getMenuItems()
        .then(items => setMenuItems(items || []))
        .catch(() => setMenuItems([]));
    }
  }, [activeTab]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (activeTab === 'dish') {
      params.type = 'dish';
      if (dishFilter) params.menuItemId = dishFilter;
    }
    getAdminReviews(params)
      .then(res => {
        setReviews(res?.data || []);
        setPagination(res?.pagination || null);
      })
      .catch(() => { setReviews([]); setPagination(null); })
      .finally(() => setLoading(false));
  }, [activeTab, page, dishFilter]);

  useEffect(() => { load(); }, [load]);

  // Reset page when tab or filter changes
  useEffect(() => { setPage(1); }, [activeTab, dishFilter]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    setDishFilter('');
    setPage(1);
  }

  const dishOptions = [
    { value: '', label: t('allDishes') },
    ...menuItems.map(item => ({ value: item._id || item.id, label: item.name || '—' })),
  ];

  return (
    <StaffShell title={<><MdRateReview /> {t('title')}</>}>
      <div className={styles.page}>

        {/* ── Tabs ── */}
        <div className={styles.tabBar}>
          {TABS.map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {t(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
            </button>
          ))}
        </div>

        {/* ── Dish filter ── */}
        {activeTab === 'dish' && (
          <div className={styles.filterRow}>
            <div className={styles.filterDropdown}>
              <Dropdown
                label={t('filterByDish')}
                options={dishOptions}
                value={dishFilter}
                onChange={val => { setDishFilter(val); setPage(1); }}
              />
            </div>
          </div>
        )}

        {/* ── Review list ── */}
        <div className={styles.list}>
          {loading ? (
            <div className={styles.empty}>{t('loading')}</div>
          ) : reviews.length === 0 ? (
            <div className={styles.empty}>{t('noReviews')}</div>
          ) : (
            reviews.map(r => (
              <ReviewCard key={r._id} review={r} isDish={activeTab === 'dish'} />
            ))
          )}
        </div>

        {/* ── Pagination ── */}
        {pagination && pagination.pages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              {t('prevPage')}
            </button>
            <span className={styles.pageInfo}>
              {t('page', { page, pages: pagination.pages })}
            </span>
            <button
              className={styles.pageBtn}
              disabled={page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
            >
              {t('nextPage')}
            </button>
          </div>
        )}

      </div>
    </StaffShell>
  );
}
