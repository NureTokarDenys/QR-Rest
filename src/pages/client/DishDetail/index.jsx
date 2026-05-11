import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import ReviewItem from '../../../components/client/ReviewItem';
import PrimaryButton from '../../../components/PrimaryButton';
import { getDishDetail } from '../../../api/menu';
import { getDishReviews } from '../../../api/reviews';
import styles from './dishDetail.module.css';
import { useToast } from '../../../context/ClientToastContext';
import { useTranslation } from 'react-i18next';
import { useLocalField, useFallbackField, useLang } from '../../../i18n/useLang';
import FallbackMark from '../../../components/FallbackMark';

const MAX_COMMENT = 300;

function normaliseDish(raw) {
  if (!raw) return null;
  // Map API shape to internal shape used by addToCart and rendering
  return {
    id: raw._id || raw.id,
    name: raw.name,
    name_en: raw.name_en || raw.name,
    price: raw.basePrice !== undefined ? raw.basePrice : raw.price,
    weight: raw.weight || null,
    image: raw.imageUrl || raw.image,
    description: raw.description,
    description_en: raw.description_en || raw.description,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    reviews: raw.reviews || [],
    ingredientsList: (raw.ingredients || raw.ingredientsList || []).map(i => ({
      id: i._id || i.id,
      name: i.name,
      name_en: i.name_en || i.name,
      isRemovable: i.isRemovable,
    })),
    addons: (raw.addons || []).map(a => ({
      id: a._id || a.id,
      name: a.name,
      name_en: a.name_en || a.name,
      price: a.price,
    })),
    componentGroups: (raw.componentGroups || []).map(g => ({
      id: g._id || g.id,
      name: g.name,
      name_en: g.name_en || g.name,
      isRequired: g.isRequired,
      options: (g.options || []).map(o => ({
        id: o._id || o.id,
        name: o.name,
        name_en: o.name_en || o.name,
        priceModifier: o.priceModifier,
        isDefault: o.isDefault ?? false,
      })),
    })),
  };
}

export default function DishDetail() {
  const { t: t1 } = useTranslation('clientToast');
  const { t: t2 } = useTranslation('notFound');
  const { t: t3 } = useTranslation('dishDetails');

  const local = useLocalField();
  const fb    = useFallbackField();
  const lang  = useLang();           // triggers re-fetch when language changes
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, updateCartItem } = useApp();
  const { showToast } = useToast();

  // If arriving from the cart via clicking the dish name, pre-fill with saved
  // modifiers and switch the bottom button to "Save changes" mode.
  const prefill    = location.state?.prefill;
  const editCartId = prefill?.cartItemId ?? null; // truthy → edit mode

  const [dish, setDish]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [reviews, setReviews]   = useState([]);
  const [ratingSummary, setRatingSummary] = useState(null); // { averageRating, totalCount }

  const [quantity, setQuantity] = useState(1);
  const [excludedIngredients, setExcludedIngredients] = useState(prefill?.excludedIngredients ?? []);
  const [selectedAddons, setSelectedAddons] = useState(prefill?.selectedAddons ?? []);
  const [componentGroupSelections, setComponentGroupSelections] = useState(prefill?.componentGroupSelections ?? {});
  const [comment, setComment] = useState(prefill?.comment ?? '');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Fetch dish details and reviews in parallel
    Promise.all([
      getDishDetail(id),
      getDishReviews(id).catch(() => null),
    ])
      .then(([dishData, reviewEnvelope]) => {
        if (cancelled) return;
        const dish = normaliseDish(dishData);
        setDish(dish);

        // Pre-select the isDefault option for any group that has no selection yet
        // (covers both fresh opens and prefill arriving from cart with missing groups)
        if (dish?.componentGroups?.length) {
          setComponentGroupSelections(prev => {
            const next = { ...prev };
            let changed = false;
            for (const g of dish.componentGroups) {
              if (!next[g.id]) {
                const def = g.options.find(o => o.isDefault);
                if (def) { next[g.id] = def.id; changed = true; }
              }
            }
            return changed ? next : prev;
          });
        }

        if (reviewEnvelope) {
          setReviews(reviewEnvelope.data || []);
          setRatingSummary(reviewEnvelope.summary || null);
        }
      })
      .catch((err) => {
        console.error('DishDetail fetch error:', err);
        if (!cancelled) setDish(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, lang]); // re-fetch when language changes so backend returns fresh translations

  if (loading) {
    return <div className={styles.notFound}>Завантаження...</div>;
  }

  if (!dish) return <div className={styles.notFound}>{t2('dish_not_found')}</div>;

  const ingredientsList = dish.ingredientsList || [];
  const addons = dish.addons || [];
  const componentGroups = dish.componentGroups || [];

  // Pre-compute fallback-aware display values
  const { value: dishName,        isFallback: nameFallback }  = fb(dish, 'name');
  const { value: dishDescription, isFallback: descFallback }  = fb(dish, 'description');

  const hasRequiredGroups = componentGroups.filter(g => g.isRequired).length > 0;
  const allRequiredGroupsFilled = componentGroups
    .filter(g => g.isRequired)
    .every(g => componentGroupSelections[g.id]);

  const canAdd = !hasRequiredGroups || allRequiredGroupsFilled;

  const addonPrice = addons
    .filter(a => selectedAddons.includes(a.id))
    .reduce((s, a) => s + a.price, 0);

  const groupPrice = Object.entries(componentGroupSelections).reduce((s, [gid, optId]) => {
    const group = componentGroups.find(g => g.id === gid);
    if (!group) return s;
    const opt = group.options.find(o => o.id === optId);
    return s + (opt ? opt.priceModifier : 0);
  }, 0);

  const unitPrice = dish.price + addonPrice + groupPrice;

  function toggleIngredient(ingId) {
    setExcludedIngredients(prev =>
      prev.includes(ingId) ? prev.filter(i => i !== ingId) : [...prev, ingId]
    );
  }

  function toggleAddon(addonId) {
    setSelectedAddons(prev =>
      prev.includes(addonId) ? prev.filter(a => a !== addonId) : [...prev, addonId]
    );
  }

  function selectComponentGroup(groupId, optionId) {
    setComponentGroupSelections(prev => ({ ...prev, [groupId]: optionId }));
  }

  function handleAdd() {
    if (editCartId) {
      // Edit mode — update the existing cart item in-place
      updateCartItem(editCartId, dish, {
        excludedIngredients,
        selectedAddons,
        componentGroupSelections,
        comment,
      });
    } else {
      // Normal mode — add one new cart entry per quantity unit
      for (let i = 0; i < quantity; i++) {
        addToCart(dish, {
          excludedIngredients,
          selectedAddons,
          componentGroupSelections,
          comment,
        });
      }
    }
    navigate(-1);
    showToast(`${t1('message_p1')} "${local(dish, 'name')}" ${t1('message_p2')}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.imageWrapper}>
        <img src={dish.image} alt={local(dish, 'name')} className={styles.image} />
        <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
      </div>

      <div className={styles.content}>
        <h1 className={styles.name}>
          {dishName}{nameFallback && <FallbackMark tip={t3('fallback_tooltip')} />}
        </h1>

        {ratingSummary && ratingSummary.totalCount > 0 && (
          <div className={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} className={i <= Math.round(ratingSummary.averageRating) ? styles.starFilled : styles.starEmpty}>★</span>
            ))}
            <span className={styles.ratingVal}>{ratingSummary.averageRating.toFixed(1)}</span>
            <span className={styles.reviewCount}>· {ratingSummary.totalCount} {t3('review', { count: ratingSummary.totalCount })}</span>
          </div>
        )}

        {dish.weight && (
          <span className={styles.weightBadge}>{dish.weight}</span>
        )}

        <p className={styles.description}>
          {dishDescription}{descFallback && <FallbackMark tip={t3('fallback_tooltip')} />}
        </p>

        {/* ComponentGroups — mandatory choice */}
        {componentGroups.map(group => {
          const { value: groupName, isFallback: groupFb } = fb(group, 'name');
          return (
            <div key={group.id} className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {groupName}{groupFb && <FallbackMark tip={t3('fallback_tooltip')} />}
                {group.isRequired && (
                  <span className={`${styles.requiredBadge} ${componentGroupSelections[group.id] ? styles.requiredBadgeDone : ''}`}>
                    {componentGroupSelections[group.id] ? t3('chosen') : t3('choose_required')}
                  </span>
                )}
              </h3>
              <div className={styles.optionsList}>
                {group.options.map(opt => {
                  const selected = componentGroupSelections[group.id] === opt.id;
                  const { value: optName, isFallback: optFb } = fb(opt, 'name');
                  return (
                    <button
                      key={opt.id}
                      className={`${styles.optionBtn} ${selected ? styles.optionBtnSelected : ''}`}
                      onClick={() => selectComponentGroup(group.id, opt.id)}
                    >
                      <span>{optName}{optFb && <FallbackMark tip={t3('fallback_tooltip')} />}</span>
                      {opt.priceModifier !== 0 && (
                        <span className={styles.optionPrice}>+{opt.priceModifier}₴</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Ingredients with removable checkboxes */}
        {ingredientsList.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t3('contents')}</h3>
            <div className={styles.ingredientsList}>
              {ingredientsList.map(ing => {
                const { value: ingName, isFallback: ingFb } = fb(ing, 'name');
                return (
                  <div key={ing.id} className={styles.ingredientRow}>
                    {ing.isRemovable ? (
                      <label className={styles.ingredientLabel}>
                        <input
                          type="checkbox"
                          className={styles.ingredientCheckbox}
                          checked={!excludedIngredients.includes(ing.id)}
                          onChange={() => toggleIngredient(ing.id)}
                        />
                        <span className={excludedIngredients.includes(ing.id) ? styles.ingredientExcluded : ''}>
                          {ingName}{ingFb && <FallbackMark tip={t3('fallback_tooltip')} />}
                        </span>
                      </label>
                    ) : (
                      <span className={styles.ingredientFixed}>
                        {ingName}{ingFb && <FallbackMark tip={t3('fallback_tooltip')} />}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {ingredientsList.some(i => i.isRemovable) && (
              <p className={styles.ingredientHint}>{t3('ingredients_hint')}</p>
            )}
          </div>
        )}

        {/* Add-ons */}
        {addons.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t3('addons')}</h3>
            <div className={styles.addonsList}>
              {addons.map(addon => {
                const checked = selectedAddons.includes(addon.id);
                const { value: addonName, isFallback: addonFb } = fb(addon, 'name');
                return (
                  <label key={addon.id} className={`${styles.addonRow} ${checked ? styles.addonRowSelected : ''}`}>
                    <input
                      type="checkbox"
                      className={styles.addonCheckbox}
                      checked={checked}
                      onChange={() => toggleAddon(addon.id)}
                    />
                    <span className={styles.addonName}>
                      {addonName}{addonFb && <FallbackMark tip={t3('fallback_tooltip')} />}
                    </span>
                    <span className={styles.addonPrice}>
                      {addon.price === 0 ? t3('free') : `+${addon.price}₴`}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-dish comment */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t3('comment')}</h3>
          <div className={styles.commentWrapper}>
            <textarea
              className={styles.commentArea}
              placeholder={t3('comment_placeholder')}
              maxLength={MAX_COMMENT}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <span className={styles.commentCount}>{comment.length}/{MAX_COMMENT}</span>
          </div>
        </div>

        {/* Reviews — loaded from GET /reviews/dish/:id */}
        {reviews.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t3('reviews')}</h3>
            <div className={styles.reviews}>
              {reviews.map(r => (
                <ReviewItem
                  key={r._id}
                  author={r.userId?.name || t3('anonymous')}
                  rating={r.rating}
                  text={r.comment || ''}
                  date={r.createdAt}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {!editCartId && (
          <div className={styles.qty}>
            <button className={styles.qtyBtn} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
            <span className={styles.qtyVal}>{quantity}</span>
            <button className={styles.qtyBtn} onClick={() => setQuantity(q => q + 1)}>+</button>
          </div>
        )}
        <div className={styles.addBtn}>
          <PrimaryButton
            label={editCartId
              ? `${t3('save_changes')} · ${unitPrice}₴`
              : `${t3('add')} · ${unitPrice * quantity}₴`}
            onClick={handleAdd}
            disabled={!canAdd}
          />
        </div>
      </div>
    </div>
  );
}
