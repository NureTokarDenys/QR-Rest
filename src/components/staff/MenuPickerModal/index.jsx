import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CategoryCard from '../../client/CategoryCard';
import DishCard from '../../client/DishCard';
import Lightbox from '../../client/Lightbox';
import FallbackMark from '../../FallbackMark';
import { getMenu, getDishDetail, searchMenu } from '../../../api/menu';
import { getStoredRestaurantId } from '../../../api/client';
import { useLocalField, useFallbackField } from '../../../i18n/useLang';
import { MdClose, MdArrowBack, MdSearch, MdShoppingCart } from 'react-icons/md';
import styles from './menuPicker.module.css';

const MAX_COMMENT = 300;

// ─── Normalisation helpers ───────────────────────────────────────────────────

function previewImg(raw) {
  const imgs = raw?.images?.length ? raw.images
    : raw?.imageUrl ? [raw.imageUrl]
    : [];
  const idx = Math.min(raw?.selectedImageIdx ?? 0, Math.max(0, imgs.length - 1));
  return imgs[idx] || null;
}

function normalizeDish(raw) {
  if (!raw) return null;
  const images = raw.images?.length ? raw.images : raw.imageUrl ? [raw.imageUrl] : [];
  const selectedImageIdx = Math.min(raw.selectedImageIdx ?? 0, Math.max(0, images.length - 1));
  return {
    id:          raw._id || raw.id,
    name:        raw.name,
    name_en:     raw.name_en || raw.name,
    price:       raw.basePrice !== undefined ? raw.basePrice : (raw.price ?? 0),
    weight:      raw.weight || null,
    images,
    selectedImageIdx,
    image:       images[selectedImageIdx] || null,
    description: raw.description,
    description_en: raw.description_en || raw.description,
    rating:      raw.rating,
    reviewCount: raw.reviewCount,
    ingredientsList: (raw.ingredients || raw.ingredientsList || []).map(i => ({
      id: i._id || i.id, name: i.name, name_en: i.name_en || i.name, isRemovable: i.isRemovable,
    })),
    addons: (raw.addons || []).map(a => ({
      id: a._id || a.id, name: a.name, name_en: a.name_en || a.name, price: a.price,
    })),
    componentGroups: (raw.componentGroups || []).map(g => ({
      id: g._id || g.id, name: g.name, name_en: g.name_en || g.name, isRequired: g.isRequired,
      options: (g.options || []).map(o => ({
        id: o._id || o.id, name: o.name, name_en: o.name_en || o.name,
        priceModifier: o.priceModifier ?? 0, isDefault: o.isDefault ?? false,
      })),
    })),
  };
}

function normalizeCategories(data) {
  if (!Array.isArray(data)) return [];
  return data
    .map(c => ({
      id:      c._id || c.id,
      name:    c.name,
      name_en: c.name_en || c.name,
      image:   previewImg(c),
      count:   c.itemCount ?? c.items?.length ?? 0,
      items:   (c.items || []).map(normalizeDish).filter(Boolean),
    }))
    .filter(c => c.items.length > 0);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MenuPickerModal({ orderId, onClose, onConfirm }) {
  const { t }  = useTranslation('tableDetail');
  const { t: tD } = useTranslation('dishDetails');
  const local = useLocalField();
  const fb    = useFallbackField();

  // ── View state ──────────────────────────────────────────────────────────────
  // 'categories' → 'items' → 'detail'
  const [view,             setView]             = useState('categories');
  const [categories,       setCategories]       = useState([]);
  const [menuLoading,      setMenuLoading]      = useState(true);
  const [searchQ,          setSearchQ]          = useState('');
  const [searchResults,    setSearchResults]    = useState(null); // null = not searching
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDish,     setSelectedDish]     = useState(null);
  const [dishLoading,      setDishLoading]      = useState(false);

  // ── Basket ──────────────────────────────────────────────────────────────────
  const [basket,     setBasket]     = useState([]);
  const [confirming, setConfirming] = useState(false);

  // ── Dish detail form state ───────────────────────────────────────────────────
  const [quantity,                 setQuantity]                 = useState(1);
  const [excludedIngredients,      setExcludedIngredients]      = useState([]);
  const [selectedAddons,           setSelectedAddons]           = useState([]);
  const [componentGroupSelections, setComponentGroupSelections] = useState({});
  const [comment,                  setComment]                  = useState('');
  const [imgIdx,                   setImgIdx]                   = useState(0);
  const [lightboxOpen,             setLightboxOpen]             = useState(false);

  const searchTimer = useRef(null);

  // ── Load menu on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    getMenu(getStoredRestaurantId())
      .then(data => setCategories(normalizeCategories(data)))
      .catch(console.error)
      .finally(() => setMenuLoading(false));
  }, []);

  // ── Search (debounced 300 ms) ────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults(null); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const raw = await searchMenu(searchQ, getStoredRestaurantId());
        setSearchResults(Array.isArray(raw) ? raw.map(normalizeDish).filter(Boolean) : []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  function openCategory(cat) {
    setSelectedCategory(cat);
    setSearchQ('');
    setSearchResults(null);
    setView('items');
  }

  async function openDish(dish) {
    setView('detail');
    setDishLoading(true);
    setSelectedDish(null);
    setQuantity(1);
    setExcludedIngredients([]);
    setSelectedAddons([]);
    setComponentGroupSelections({});
    setComment('');
    setImgIdx(0);

    try {
      const raw = await getDishDetail(dish.id, getStoredRestaurantId());
      const normalized = normalizeDish(raw);
      setSelectedDish(normalized);
      if (normalized?.componentGroups?.length) {
        const defaults = {};
        for (const g of normalized.componentGroups) {
          const def = g.options.find(o => o.isDefault);
          if (def) defaults[g.id] = def.id;
        }
        if (Object.keys(defaults).length) setComponentGroupSelections(defaults);
      }
    } catch (e) {
      console.error('openDish:', e);
      setSelectedDish(normalizeDish(dish));
    } finally {
      setDishLoading(false);
    }
  }

  function goBack() {
    if (view === 'detail') {
      setView(selectedCategory ? 'items' : 'categories');
    } else if (view === 'items') {
      setSearchQ('');
      setSearchResults(null);
      setView('categories');
    }
  }

  // ── Basket ───────────────────────────────────────────────────────────────────
  function addToBasket() {
    if (!selectedDish) return;

    const addonPrice = selectedDish.addons
      .filter(a => selectedAddons.includes(a.id))
      .reduce((s, a) => s + a.price, 0);

    const groupPrice = Object.entries(componentGroupSelections).reduce((s, [gid, optId]) => {
      const grp = selectedDish.componentGroups.find(g => g.id === gid);
      const opt = grp?.options.find(o => o.id === optId);
      return s + (opt?.priceModifier || 0);
    }, 0);

    const unitPrice = selectedDish.price + addonPrice + groupPrice;

    setBasket(prev => [...prev, {
      key:         `${selectedDish.id}-${Date.now()}`,
      menuItemId:  selectedDish.id,
      displayName: local(selectedDish, 'name'),
      qty:         quantity,
      unitPrice,
      // API format
      addons:                selectedAddons.map(id => ({ addOnId: id, quantity: 1 })),
      excludedIngredients,
      componentGroupChoices: Object.entries(componentGroupSelections)
        .map(([groupId, optionId]) => ({ groupId, optionId })),
      comment,
    }]);
    goBack();
  }

  async function handleConfirm() {
    if (!basket.length || confirming) return;
    setConfirming(true);
    try {
      const items = basket.map(b => ({
        menuItemId:            b.menuItemId,
        qty:                   b.qty,
        comment:               b.comment || undefined,
        addons:                b.addons,
        excludedIngredients:   b.excludedIngredients,
        componentGroupChoices: b.componentGroupChoices,
      }));
      await onConfirm(items);
    } finally {
      setConfirming(false);
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const basketTotal = basket.reduce((s, b) => s + b.unitPrice * b.qty, 0);
  const basketCount = basket.reduce((s, b) => s + b.qty, 0);

  const dishAddonPrice = selectedDish
    ? selectedDish.addons.filter(a => selectedAddons.includes(a.id)).reduce((s, a) => s + a.price, 0)
    : 0;
  const dishGroupPrice = selectedDish
    ? Object.entries(componentGroupSelections).reduce((s, [gid, optId]) => {
        const grp = selectedDish.componentGroups.find(g => g.id === gid);
        const opt = grp?.options.find(o => o.id === optId);
        return s + (opt?.priceModifier || 0);
      }, 0)
    : 0;
  const dishUnitPrice = selectedDish ? selectedDish.price + dishAddonPrice + dishGroupPrice : 0;

  const hasRequiredGroups = selectedDish?.componentGroups.some(g => g.isRequired) ?? false;
  const allRequiredFilled = !selectedDish || selectedDish.componentGroups
    .filter(g => g.isRequired)
    .every(g => componentGroupSelections[g.id]);
  const canAdd = !hasRequiredGroups || allRequiredFilled;

  const currentItems   = selectedCategory?.items ?? [];
  const displayedItems = searchResults !== null ? searchResults : currentItems;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.header}>
          {view !== 'categories' && (
            <button className={styles.backBtn} onClick={goBack} aria-label="Back">
              <MdArrowBack />
            </button>
          )}

          {view !== 'detail' ? (
            <div className={styles.searchBar}>
              <MdSearch className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder={t('searchDish')}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                autoFocus={view === 'categories'}
              />
              {searchQ && (
                <button className={styles.clearBtn} onClick={() => setSearchQ('')}>×</button>
              )}
            </div>
          ) : (
            <span className={styles.headerTitle}>
              {selectedDish ? local(selectedDish, 'name') : '…'}
            </span>
          )}

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <MdClose />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className={styles.content}>

          {/* CATEGORIES VIEW */}
          {view === 'categories' && (
            menuLoading ? (
              <div className={styles.emptyMsg}>{t('loading')}</div>
            ) : searchResults !== null ? (
              searchResults.length === 0 ? (
                <div className={styles.emptyMsg}>{t('noResults')}</div>
              ) : (
                <div className={styles.dishGrid}>
                  {searchResults.map(d => (
                    <DishCard key={d.id} dish={d} onClick={openDish} />
                  ))}
                </div>
              )
            ) : (
              <div className={styles.catGrid}>
                {categories.map(cat => (
                  <CategoryCard key={cat.id} cat={cat} onClick={openCategory} />
                ))}
              </div>
            )
          )}

          {/* ITEMS VIEW */}
          {view === 'items' && (
            displayedItems.length === 0 ? (
              <div className={styles.emptyMsg}>{t('noResults')}</div>
            ) : (
              <div className={styles.dishGrid}>
                {displayedItems.map(d => (
                  <DishCard key={d.id} dish={d} onClick={openDish} />
                ))}
              </div>
            )
          )}

          {/* DISH DETAIL VIEW */}
          {view === 'detail' && (
            dishLoading || !selectedDish ? (
              <div className={styles.emptyMsg}>{t('loading')}</div>
            ) : (() => {
              const dish = selectedDish;
              const { value: dishName, isFallback: nameFb } = fb(dish, 'name');
              const { value: dishDesc, isFallback: descFb } = fb(dish, 'description');

              return (
                <div className={styles.detailView}>
                  {/* Image carousel */}
                  {dish.images.length > 0 && (
                    <div className={styles.detailImage}>
                      <img
                        src={dish.images[imgIdx]}
                        alt={dishName}
                        className={styles.detailImgEl}
                        onClick={() => setLightboxOpen(true)}
                      />
                      {dish.images.length > 1 && (
                        <>
                          <button className={`${styles.imgArrow} ${styles.imgArrowLeft}`}
                            onClick={() => setImgIdx(i => (i - 1 + dish.images.length) % dish.images.length)}>
                            ‹
                          </button>
                          <button className={`${styles.imgArrow} ${styles.imgArrowRight}`}
                            onClick={() => setImgIdx(i => (i + 1) % dish.images.length)}>
                            ›
                          </button>
                          <div className={styles.imgDots}>
                            {dish.images.map((_, i) => (
                              <button key={i}
                                className={`${styles.imgDot} ${i === imgIdx ? styles.imgDotActive : ''}`}
                                onClick={() => setImgIdx(i)} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className={styles.detailContent}>
                    <h2 className={styles.detailName}>
                      {dishName}
                      {nameFb && <FallbackMark tip={tD('fallback_tooltip')} />}
                    </h2>
                    {dish.weight && <span className={styles.detailWeight}>{dish.weight}</span>}
                    {dishDesc && (
                      <p className={styles.detailDesc}>
                        {dishDesc}
                        {descFb && <FallbackMark tip={tD('fallback_tooltip')} />}
                      </p>
                    )}

                    {/* Component groups */}
                    {dish.componentGroups.map(group => {
                      const { value: gName, isFallback: gFb } = fb(group, 'name');
                      return (
                        <div key={group.id} className={styles.section}>
                          <h3 className={styles.sectionTitle}>
                            {gName}{gFb && <FallbackMark tip={tD('fallback_tooltip')} />}
                            {group.isRequired && (
                              <span className={`${styles.requiredBadge} ${componentGroupSelections[group.id] ? styles.requiredBadgeDone : ''}`}>
                                {componentGroupSelections[group.id] ? tD('chosen') : tD('choose_required')}
                              </span>
                            )}
                          </h3>
                          <div className={styles.optionsList}>
                            {group.options.map(opt => {
                              const sel = componentGroupSelections[group.id] === opt.id;
                              const { value: oName, isFallback: oFb } = fb(opt, 'name');
                              return (
                                <button key={opt.id}
                                  className={`${styles.optionBtn} ${sel ? styles.optionBtnSelected : ''}`}
                                  onClick={() => setComponentGroupSelections(p => ({ ...p, [group.id]: opt.id }))}>
                                  <span>{oName}{oFb && <FallbackMark tip={tD('fallback_tooltip')} />}</span>
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

                    {/* Removable ingredients */}
                    {dish.ingredientsList.length > 0 && (
                      <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>{tD('contents')}</h3>
                        <div className={styles.ingredientsList}>
                          {dish.ingredientsList.map(ing => {
                            const { value: iName, isFallback: iFb } = fb(ing, 'name');
                            return (
                              <div key={ing.id} className={styles.ingredientRow}>
                                {ing.isRemovable ? (
                                  <label className={styles.ingredientLabel}>
                                    <input type="checkbox" className={styles.ingredientCheckbox}
                                      checked={!excludedIngredients.includes(ing.id)}
                                      onChange={() => setExcludedIngredients(prev =>
                                        prev.includes(ing.id)
                                          ? prev.filter(i => i !== ing.id)
                                          : [...prev, ing.id]
                                      )} />
                                    <span className={excludedIngredients.includes(ing.id) ? styles.ingredientExcluded : ''}>
                                      {iName}{iFb && <FallbackMark tip={tD('fallback_tooltip')} />}
                                    </span>
                                  </label>
                                ) : (
                                  <span className={styles.ingredientFixed}>
                                    {iName}{iFb && <FallbackMark tip={tD('fallback_tooltip')} />}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {dish.ingredientsList.some(i => i.isRemovable) && (
                          <p className={styles.ingredientHint}>{tD('ingredients_hint')}</p>
                        )}
                      </div>
                    )}

                    {/* Addons */}
                    {dish.addons.length > 0 && (
                      <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>{tD('addons')}</h3>
                        <div className={styles.addonsList}>
                          {dish.addons.map(addon => {
                            const checked = selectedAddons.includes(addon.id);
                            const { value: aName, isFallback: aFb } = fb(addon, 'name');
                            return (
                              <label key={addon.id}
                                className={`${styles.addonRow} ${checked ? styles.addonRowSelected : ''}`}>
                                <input type="checkbox" className={styles.addonCheckbox}
                                  checked={checked}
                                  onChange={() => setSelectedAddons(prev =>
                                    prev.includes(addon.id)
                                      ? prev.filter(a => a !== addon.id)
                                      : [...prev, addon.id]
                                  )} />
                                <span className={styles.addonName}>
                                  {aName}{aFb && <FallbackMark tip={tD('fallback_tooltip')} />}
                                </span>
                                <span className={styles.addonPrice}>
                                  {addon.price === 0 ? tD('free') : `+${addon.price}₴`}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Comment */}
                    <div className={styles.section}>
                      <h3 className={styles.sectionTitle}>{tD('comment')}</h3>
                      <div className={styles.commentWrapper}>
                        <textarea
                          className={styles.commentArea}
                          placeholder={tD('comment_placeholder')}
                          maxLength={MAX_COMMENT}
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                        />
                        <span className={styles.commentCount}>{comment.length}/{MAX_COMMENT}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* ── Dish-detail footer: qty + add-to-basket ── */}
        {view === 'detail' && selectedDish && !dishLoading && (
          <div className={styles.footer}>
            <div className={styles.qtyRow}>
              <button className={styles.qtyBtn}
                onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>−</button>
              <span className={styles.qtyVal}>{quantity}</span>
              <button className={styles.qtyBtn}
                onClick={() => setQuantity(q => Math.min(10, q + 1))} disabled={quantity >= 10}>+</button>
            </div>
            <button className={styles.addToBasketBtn} onClick={addToBasket} disabled={!canAdd}>
              {t('pickerAddToBasket', { price: (dishUnitPrice * quantity).toFixed(0) })}
            </button>
          </div>
        )}

        {/* ── Basket bar: shown when there are items + not in detail ── */}
        {basket.length > 0 && view !== 'detail' && (
          <div className={styles.basketBar}>
            <div className={styles.basketInfo}>
              <MdShoppingCart className={styles.basketIcon} />
              <span className={styles.basketCount}>
                {basketCount} × {basketTotal.toFixed(0)}₴
              </span>
            </div>
            <button className={styles.confirmBtn} onClick={handleConfirm} disabled={confirming}>
              {confirming ? '…' : t('pickerConfirmOrder')}
            </button>
          </div>
        )}
      </div>

      {selectedDish && (
        <Lightbox
          images={selectedDish.images}
          initialIndex={imgIdx}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          alt={selectedDish ? local(selectedDish, 'name') : ''}
        />
      )}
    </div>
  );
}
