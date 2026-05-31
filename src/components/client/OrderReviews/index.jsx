import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdLock } from 'react-icons/md';
import { useAuth } from '../../../context/AuthContext';
import { useLocalField } from '../../../i18n/useLang';
import {
  getMyReviewsForOrder,
  submitRestaurantReview,
  submitDishReview,
} from '../../../api/reviews';
import styles from './orderReviews.module.css';

// Reviews open up once the order is paid: paid-in-advance (open_paid) or any
// closed/completed state. They are NOT available before payment.
const PAID_OK = new Set(['open_paid', 'completed_cash', 'completed_epay']);

/**
 * Star picker — 1..5 stars. `value` is the currently selected rating (0 = none).
 * Renders read-only when `disabled` is true.
 */
function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className={`${styles.stars} ${disabled ? styles.starsDisabled : ''}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className={i <= display ? styles.starFilled : styles.starEmpty}
          onClick={disabled ? undefined : () => onChange(i)}
          onMouseEnter={disabled ? undefined : () => setHover(i)}
          onMouseLeave={disabled ? undefined : () => setHover(0)}
          aria-label={`${i}`}
          disabled={disabled}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * A single review form. Used twice: once for the restaurant, once per dish.
 *   - title:    section heading (e.g. "How was the restaurant?")
 *   - subtitle: optional subline (e.g. dish name)
 *   - existing: the user's previously-submitted review (read-only fallback)
 *   - onSubmit: ({rating, comment}) => Promise<review>
 */
function ReviewForm({ title, subtitle, existing, onSubmit }) {
  const { t } = useTranslation('orderStatus');
  const [rating, setRating]   = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [submitted, setSubmitted] = useState(Boolean(existing));
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');

  async function handleSubmit() {
    if (!rating || busy || submitted) return;
    setBusy(true);
    setErr('');
    try {
      await onSubmit({ rating, comment: comment.trim() });
      setSubmitted(true);
    } catch (e) {
      setErr(t('reviews_error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{title}</span>
        {subtitle && <span className={styles.cardSubtitle}>{subtitle}</span>}
      </div>

      <StarPicker value={rating} onChange={setRating} disabled={submitted} />

      {!submitted && (
        <>
          <textarea
            className={styles.textarea}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t('reviews_placeholder')}
            rows={2}
            maxLength={1000}
          />
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={!rating || busy}
          >
            {busy ? t('reviews_submitting') : t('reviews_submit')}
          </button>
          {err && <p className={styles.errText}>{err}</p>}
        </>
      )}

      {submitted && comment && (
        <p className={styles.submittedText}>«{comment}»</p>
      )}

      {submitted && (
        <p className={styles.thanksText}>✓ {t('reviews_submitted')}</p>
      )}
    </div>
  );
}

/**
 * Review panel — shown once an order is paid (open_paid or completed_*).
 * Lets the guest leave one rating for the restaurant + one for each dish.
 *
 * Behaviour:
 *   - Hidden entirely before payment (order not yet open_paid/completed).
 *   - Free-plan restaurants: the panel is shown but locked (reviews are a
 *     premium-only feature; the backend rejects the POST anyway).
 *   - Premium restaurants: full review forms; unauthenticated guests are asked
 *     to log in (no userId means the backend can't attribute the review).
 */
export default function OrderReviews({ orderId, restaurantId, restaurantPlan, items, status }) {
  const { t } = useTranslation('orderStatus');
  const local = useLocalField();
  const { user } = useAuth();

  const paid       = PAID_OK.has(status) && Boolean(orderId) && Boolean(restaurantId);
  const isPremium  = restaurantPlan === 'premium';
  const eligible   = paid && isPremium;

  const [existing, setExisting] = useState(null); // { restaurantReview, dishReviews }
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!eligible || !user) return;
    let cancelled = false;
    getMyReviewsForOrder(orderId, restaurantId)
      .then(data => { if (!cancelled) setExisting(data || { restaurantReview: null, dishReviews: [] }); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [eligible, orderId, restaurantId, user]);

  // Not yet paid — nothing to show.
  if (!paid) return null;

  // Free plan — the review UI is present but locked (premium-only feature).
  if (!isPremium) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.title}>{t('reviews_title')}</p>
        <div className={styles.lockedCard}>
          <MdLock className={styles.lockedIcon} />
          <p className={styles.lockedText}>{t('reviews_unavailable_free')}</p>
          <StarPicker value={0} onChange={() => {}} disabled />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.title}>{t('reviews_title')}</p>
        <p className={styles.loginHint}>{t('reviews_login_required')}</p>
      </div>
    );
  }

  // Still loading existing reviews — render the shell so layout doesn't jump.
  if (!existing && !loadFailed) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.title}>{t('reviews_title')}</p>
        <p className={styles.sub}>{t('reviews_sub')}</p>
      </div>
    );
  }

  const reviewByOrderItemId = new Map(
    (existing?.dishReviews || []).map(r => [String(r.orderItemId), r])
  );

  // Dedupe dishes: a guest who ordered the same dish twice should rate it once
  // per OrderItem (matches the unique index on orderItemId).
  const dishCards = items.map(item => ({
    orderItemId: String(item.orderItemId || item.id),
    label: local(item, 'name') || item.name,
    existing: reviewByOrderItemId.get(String(item.orderItemId || item.id)) || null,
  }));

  const allDone =
    Boolean(existing?.restaurantReview) &&
    dishCards.every(d => d.existing);

  return (
    <div className={styles.wrapper}>
      <p className={styles.title}>{t('reviews_title')}</p>
      {!allDone && <p className={styles.sub}>{t('reviews_sub')}</p>}

      <ReviewForm
        title={t('reviews_restaurant_label')}
        existing={existing?.restaurantReview}
        onSubmit={async ({ rating, comment }) => {
          await submitRestaurantReview({ orderId, rating, comment }, restaurantId);
        }}
      />

      {dishCards.map(d => (
        <ReviewForm
          key={d.orderItemId}
          title={t('reviews_dish_label')}
          subtitle={d.label}
          existing={d.existing}
          onSubmit={async ({ rating, comment }) => {
            await submitDishReview(
              { orderItemId: d.orderItemId, rating, comment },
              restaurantId,
            );
          }}
        />
      ))}

      {allDone && <p className={styles.allDone}>{t('reviews_all_done')}</p>}
    </div>
  );
}
