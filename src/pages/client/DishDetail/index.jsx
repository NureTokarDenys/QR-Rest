import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import ReviewItem from '../../../components/client/ReviewItem';
import PrimaryButton from '../../../components/PrimaryButton';
import { getDishById } from '../../../data/mockData';
import { getDishDetail } from '../../../api/menu';
import styles from './dishDetail.module.css';
import { useToast } from '../../../context/ClientToastContext';
import { useTranslation } from 'react-i18next';
import { useLocalField } from '../../../i18n/useLang';

const MAX_COMMENT = 300;

function normaliseDish(raw) {
  if (!raw) return null;
  // Map API shape to internal shape used by addToCart and rendering
  return {
    id: raw._id || raw.id,
    name: raw.name,
    name_en: raw.name_en || raw.name,
    price: raw.basePrice !== undefined ? raw.basePrice : raw.price,
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
      })),
    })),
  };
}

export default function DishDetail() {
  const { t: t1 } = useTranslation('clientToast');
  const { t: t2 } = useTranslation('notFound');
  const { t: t3 } = useTranslation('dishDetails');

  const local = useLocalField();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useApp();
  const { showToast } = useToast();

  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(true);

  const [quantity, setQuantity] = useState(1);
  const [excludedIngredients, setExcludedIngredients] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [componentGroupSelections, setComponentGroupSelections] = useState({});
  const [comment, setComment] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getDishDetail(id)
      .then((data) => {
        if (!cancelled) {
          setDish(normaliseDish(data));
        }
      })
      .catch((err) => {
        console.error('getDishDetail error:', err);
        if (!cancelled) {
          // Fallback to mock data
          const mockDish = getDishById(id);
          setDish(mockDish || null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div className={styles.notFound}>Завантаження...</div>;
  }

  if (!dish) return <div className={styles.notFound}>{t2('dish_not_found')}</div>;

  const ingredientsList = dish.ingredientsList || [];
  const addons = dish.addons || [];
  const componentGroups = dish.componentGroups || [];

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
    for (let i = 0; i < quantity; i++) {
      addToCart(dish, {
        excludedIngredients,
        selectedAddons,
        componentGroupSelections,
        comment,
      });
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
        <h1 className={styles.name}>{local(dish, 'name')}</h1>

        {dish.rating !== undefined && (
          <div className={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} className={i <= Math.floor(dish.rating) ? styles.starFilled : styles.starEmpty}>★</span>
            ))}
            <span className={styles.ratingVal}>{dish.rating}</span>
            <span className={styles.reviewCount}>· {dish.reviewCount} {t3('review', { count: dish.reviewCount })}</span>
          </div>
        )}

        <p className={styles.description}>{local(dish, 'description')}</p>

        {/* ComponentGroups — mandatory choice */}
        {componentGroups.map(group => (
          <div key={group.id} className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {local(group, 'name')}
              {group.isRequired && (
                <span className={`${styles.requiredBadge} ${componentGroupSelections[group.id] ? styles.requiredBadgeDone : ''}`}>
                  {componentGroupSelections[group.id] ? t3('chosen') : t3('choose_required')}
                </span>
              )}
            </h3>
            <div className={styles.optionsList}>
              {group.options.map(opt => {
                const selected = componentGroupSelections[group.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    className={`${styles.optionBtn} ${selected ? styles.optionBtnSelected : ''}`}
                    onClick={() => selectComponentGroup(group.id, opt.id)}
                  >
                    <span>{local(opt, 'name')}</span>
                    {opt.priceModifier !== 0 && (
                      <span className={styles.optionPrice}>+{opt.priceModifier}₴</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Ingredients with removable checkboxes */}
        {ingredientsList.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t3('contents')}</h3>
            <div className={styles.ingredientsList}>
              {ingredientsList.map(ing => (
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
                        {local(ing, 'name')}
                      </span>
                    </label>
                  ) : (
                    <span className={styles.ingredientFixed}>{local(ing, 'name')}</span>
                  )}
                </div>
              ))}
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
                return (
                  <label key={addon.id} className={`${styles.addonRow} ${checked ? styles.addonRowSelected : ''}`}>
                    <input
                      type="checkbox"
                      className={styles.addonCheckbox}
                      checked={checked}
                      onChange={() => toggleAddon(addon.id)}
                    />
                    <span className={styles.addonName}>{local(addon, 'name')}</span>
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

        {/* Reviews */}
        {dish.reviews && dish.reviews.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t3('reviews')}</h3>
            <div className={styles.reviews}>
              {dish.reviews.map((r, i) => (
                <ReviewItem key={i} author={r.author} rating={r.rating} text={local(r, 'text')} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.qty}>
          <button className={styles.qtyBtn} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <span className={styles.qtyVal}>{quantity}</span>
          <button className={styles.qtyBtn} onClick={() => setQuantity(q => q + 1)}>+</button>
        </div>
        <div className={styles.addBtn}>
          <PrimaryButton
            label={`${t3('add')} · ${unitPrice * quantity}₴`}
            onClick={handleAdd}
            disabled={!canAdd}
          />
        </div>
      </div>
    </div>
  );
}
