import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';
import { getDishDetail } from '../../../api/menu';
import styles from './cartItem.module.css';
import { useLocalField } from '../../../i18n/useLang';
import { useCartItemName } from '../../../hooks/useCartItemName';
import { useTranslation } from 'react-i18next';
import { MdDelete, MdExpandMore, MdExpandLess, MdContentCopy } from 'react-icons/md';

/**
 * Maps the raw API dish response into everything the details panel needs:
 * names for display + prices for recalculating the cart item total on change.
 */
function mapDetail(raw) {
  if (!raw) return null;
  return {
    price: raw.basePrice !== undefined ? raw.basePrice : (raw.price ?? 0),
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
      price: a.price ?? 0,
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
        priceModifier: o.priceModifier ?? 0,
        isDefault: o.isDefault ?? false,
      })),
    })),
  };
}

export default function CartItem({ item }) {
  const { removeFromCart, updateCartItem, duplicateCartItem, updateItemComment } = useApp();
  const local = useLocalField();
  const displayName = useCartItemName(item);
  const navigate = useNavigate();
  const { t } = useTranslation('cart');

  // ── Expand / fetch state ───────────────────────────────────────────────────
  const [expanded, setExpanded]           = useState(false);
  const [detail, setDetail]               = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Ref-based guard so hover + pointerdown + click never double-fetch
  const fetchStarted = useRef(false);

  // ── Local selection state — mirrors item.* but editable in-panel ──────────
  // Initialised once from the cart item's saved values (lazy initialisers).
  const [localExcluded, setLocalExcluded] = useState(
    () => new Set(item.excludedIngredients ?? [])
  );
  const [localAddons, setLocalAddons] = useState(
    () => new Set(item.selectedAddons ?? [])
  );
  const [localGroups, setLocalGroups] = useState(
    () => ({ ...(item.componentGroupSelections ?? {}) })
  );
  const [localComment, setLocalComment] = useState(() => item.comment ?? '');

  // ── Helpers ────────────────────────────────────────────────────────────────

  function openDishDetail() {
    navigate(`/dish/${item.id}`, {
      state: {
        prefill: {
          cartItemId:               item.cartItemId,
          excludedIngredients:      [...localExcluded],
          selectedAddons:           [...localAddons],
          componentGroupSelections: { ...localGroups },
          comment:                  localComment,
        },
      },
    });
  }

  /**
   * Starts the dish-detail fetch as early as possible (hover or pointerdown).
   * The ref guard makes it safe to call multiple times — only the first call fetches.
   */
  function prefetchDetail() {
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    setDetailLoading(true);
    getDishDetail(item.id)
      .then(raw => {
        const mapped = mapDetail(raw);
        setDetail(mapped);

        // Apply isDefault for any group not yet recorded in this cart item.
        const withDefaults = { ...(item.componentGroupSelections ?? {}) };
        let hasNewDefaults = false;
        for (const g of mapped.componentGroups) {
          if (!withDefaults[g.id]) {
            const def = g.options.find(o => o.isDefault);
            if (def) { withDefaults[g.id] = def.id; hasNewDefaults = true; }
          }
        }
        if (hasNewDefaults) {
          setLocalGroups(withDefaults);
          updateCartItem(item.cartItemId, mapped, {
            excludedIngredients:      item.excludedIngredients ?? [],
            selectedAddons:           item.selectedAddons      ?? [],
            componentGroupSelections: withDefaults,
            comment:                  localComment,
          });
        }
      })
      .catch(() => {
        fetchStarted.current = false; // allow retry on error
        setDetail(null);
      })
      .finally(() => setDetailLoading(false));
  }

  /** Toggles the panel; also acts as a keyboard-accessible fallback for prefetch. */
  function toggleExpand() {
    prefetchDetail(); // no-op if already fetched
    setExpanded(prev => !prev);
  }

  /**
   * Persist any selection change immediately to the cart.
   * Called after every local state mutation so the price stays in sync.
   */
  function persist(newExcluded, newAddons, newGroups) {
    updateCartItem(item.cartItemId, detail, {
      excludedIngredients:      [...newExcluded],
      selectedAddons:           [...newAddons],
      componentGroupSelections: { ...newGroups },
      comment:                  localComment,
    });
  }

  function toggleIngredient(ingId) {
    const next = new Set(localExcluded);
    next.has(ingId) ? next.delete(ingId) : next.add(ingId);
    setLocalExcluded(next);
    persist(next, localAddons, localGroups);
  }

  function toggleAddon(addonId) {
    const next = new Set(localAddons);
    next.has(addonId) ? next.delete(addonId) : next.add(addonId);
    setLocalAddons(next);
    persist(localExcluded, next, localGroups);
  }

  function selectGroup(groupId, optionId) {
    const next = { ...localGroups, [groupId]: optionId };
    setLocalGroups(next);
    persist(localExcluded, localAddons, next);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <img src={item.image} alt={displayName} className={styles.image} />

      <div className={styles.info}>
        {/* Dish name → navigates to DishDetail with current selections pre-filled */}
        <button className={styles.nameBtn} onClick={openDishDetail}>
          {displayName}
        </button>

        {item.comment ? <span className={styles.comment}>💬 {item.comment}</span> : null}

        <span className={styles.price}>{item.price * item.quantity}₴</span>

        <div className={styles.controls}>
          <button
            className={styles.duplicateBtn}
            onClick={() => duplicateCartItem(item.cartItemId)}
          >
            <MdContentCopy />
            <span>{t('duplicate_item')}</span>
          </button>
          <button className={styles.deleteBtn} onClick={() => removeFromCart(item.cartItemId)}>
            <MdDelete />
          </button>

          <button
            className={styles.detailsToggle}
            onMouseEnter={prefetchDetail}
            onPointerDown={prefetchDetail}
            onClick={toggleExpand}
          >
            {expanded ? <MdExpandLess /> : <MdExpandMore />}
            <span>{expanded ? t('details_hide') : t('details_show')}</span>
          </button>
        </div>

        {/* ── Expandable live-edit panel ──
             Always rendered; height animated via grid-template-rows trick.
             overflow:hidden on the inner wrapper clips content during transition. */}
        <div className={`${styles.detailsOuter} ${expanded ? styles.detailsOuterOpen : ''}`}>
          <div className={styles.detailsInner}>
            <div className={styles.detailsPanel}>
              {/* Comment field — always available, no detail fetch required */}
              <div className={styles.detailSection}>
                <span className={styles.detailSectionLabel}>{t('dish_comment')}</span>
                <textarea
                  className={styles.commentTextarea}
                  placeholder={t('dish_comment_placeholder')}
                  value={localComment}
                  onChange={e => {
                    setLocalComment(e.target.value);
                    updateItemComment(item.cartItemId, e.target.value);
                  }}
                  rows={2}
                />
              </div>

              {detail && (
                <>
                  {/* Component groups — radio chip row per group */}
                  {detail.componentGroups.map(g => (
                    <div key={g.id} className={styles.detailSection}>
                      <span className={styles.detailSectionLabel}>
                        {local(g, 'name')}
                        {g.isRequired && <span className={styles.requiredDot} />}
                      </span>
                      <div className={styles.chipRow}>
                        {g.options.map(opt => {
                          const selected = localGroups[g.id] === opt.id;
                          return (
                            <button
                              key={opt.id}
                              className={`${styles.chip} ${selected ? styles.chipSelected : styles.chipIdle}`}
                              onClick={() => selectGroup(g.id, opt.id)}
                            >
                              {local(opt, 'name')}
                              {opt.priceModifier !== 0 && (
                                <span className={styles.chipPrice}>
                                  {opt.priceModifier > 0 ? '+' : ''}{opt.priceModifier}₴
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Add-ons — toggle chip row */}
                  {detail.addons.length > 0 && (
                    <div className={styles.detailSection}>
                      <span className={styles.detailSectionLabel}>{t('details_addons')}</span>
                      <div className={styles.chipRow}>
                        {detail.addons.map(a => {
                          const active = localAddons.has(a.id);
                          return (
                            <button
                              key={a.id}
                              className={`${styles.chip} ${active ? styles.chipAddonActive : styles.chipIdle}`}
                              onClick={() => toggleAddon(a.id)}
                            >
                              {active ? '✓ ' : '+ '}{local(a, 'name')}
                              {a.price > 0 && (
                                <span className={styles.chipPrice}>+{a.price}₴</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ingredients — removable ones are toggle-able */}
                  {detail.ingredientsList.length > 0 && (
                    <div className={styles.detailSection}>
                      <span className={styles.detailSectionLabel}>{t('details_ingredients')}</span>
                      <div className={styles.ingredientPills}>
                        {detail.ingredientsList.map(ing => {
                          const excluded = localExcluded.has(ing.id);
                          return ing.isRemovable ? (
                            <button
                              key={ing.id}
                              className={`${styles.ingredientPill} ${styles.ingredientPillClickable} ${excluded ? styles.ingredientPillExcluded : ''}`}
                              onClick={() => toggleIngredient(ing.id)}
                            >
                              {excluded && <span className={styles.pillX}>✕</span>}
                              {local(ing, 'name')}
                            </button>
                          ) : (
                            <span key={ing.id} className={styles.ingredientPill}>
                              {local(ing, 'name')}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
