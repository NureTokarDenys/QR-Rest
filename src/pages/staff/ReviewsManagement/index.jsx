import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import { Dropdown } from '../../../components/Dropdown';
import { Skel } from '../../../components/staff/Skeleton';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { getAdminReviews, deleteAdminReview } from '../../../api/admin';
import { useStaffData } from '../../../context/StaffDataContext';
import styles from './reviewsManagement.module.css';
import { MdStar, MdStarBorder, MdRateReview, MdDeleteOutline } from 'react-icons/md';

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

function ReviewCard({ review, isDish, onDeleteRequest }) {
  const { t } = useTranslation('reviewsManagement');

  const author   = review.userId?.name || '—';
  const initial  = author !== '—' ? author.charAt(0).toUpperCase() : '?';
  const date     = review.createdAt ? new Date(review.createdAt).toLocaleDateString() : '';
  const dishName = review.menuItemId?.name || '';

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.authorBlock}>
          <span className={styles.author}>{author}</span>
          {isDish && dishName && <span className={styles.dishTag}>{dishName}</span>}
        </div>
        <div className={styles.metaBlock}>
          <Stars rating={review.rating} />
          <span className={styles.date}>{date}</span>
        </div>
        <button
          className={styles.deleteBtn}
          title={t('deleteReview')}
          onClick={() => onDeleteRequest(review._id)}
        >
          <MdDeleteOutline />
        </button>
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
  const [dishFilter,  setDishFilter]  = useState('');
  const [confirmId,   setConfirmId]   = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Menu items for the dish-filter dropdown come from the shared cache.
  // Only requested when the user actually switches to the "dish" tab.
  const { menuItems: cachedMenu, ensureMenuItems } = useStaffData();
  useEffect(() => { if (activeTab === 'dish') ensureMenuItems(); }, [activeTab, ensureMenuItems]);
  const menuItems = cachedMenu || [];

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

  async function handleDeleteConfirmed() {
    const id   = confirmId;
    const type = activeTab === 'dish' ? 'dish' : 'restaurant';
    setConfirmId(null);
    setDeleteError('');
    try {
      await deleteAdminReview(id, type);
      setReviews(prev => prev.filter(r => r._id !== id));
    } catch {
      setDeleteError(t('deleteError'));
    }
  }

  const dishOptions = [
    { value: '', label: t('allDishes') },
    ...menuItems.map(item => ({ value: item._id || item.id, label: item.name || '—' })),
  ];

  return (
    <StaffShell title={<><MdRateReview /> {t('title')}</>}>
      <div className={styles.page}>
        <ConfirmDialog
          open={confirmId !== null}
          title={t('deleteReview')}
          message={t('confirmDelete')}
          confirmLabel={t('deleteConfirm')}
          cancelLabel={t('cancel')}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmId(null)}
          danger
        />

        {deleteError && <p className={styles.deleteError}>{deleteError}</p>}

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
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Skel w={40} h={40} r="50%" />
                    <Skel w={140} h={15} />
                  </div>
                  <Skel w={90} h={18} r={6} />
                </div>
                <Skel w="100%" h={12} style={{ marginBottom: 6 }} />
                <Skel w="75%" h={12} />
              </div>
            ))
          ) : reviews.length === 0 ? (
            <div className={styles.empty}>{t('noReviews')}</div>
          ) : (
            reviews.map(r => (
              <ReviewCard key={r._id} review={r} isDish={activeTab === 'dish'} onDeleteRequest={setConfirmId} />
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
