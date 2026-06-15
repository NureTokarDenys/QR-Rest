import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Lightbox from '../../client/Lightbox';
import FallbackMark from '../../FallbackMark';
import { getDishDetail } from '../../../api/menu';
import { getStoredRestaurantId } from '../../../api/client';
import { updateOrderItem } from '../../../api/orders';
import { useLocalField, useFallbackField } from '../../../i18n/useLang';
import { MdClose, MdArrowBack } from 'react-icons/md';
import styles from '../MenuPickerModal/menuPicker.module.css';

const MAX_COMMENT = 300;

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

export default function DishEditModal({ orderId, item, onClose, onSaved }) {
  const { t }  = useTranslation('tableDetail');
  const { t: tD } = useTranslation('dishDetails');
  const local = useLocalField();
  const fb    = useFallbackField();

  const [dish,     setDish]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [imgIdx,   setImgIdx]   = useState(0);
  const [lbOpen,   setLbOpen]   = useState(false);

  const [quantity,                 setQuantity]                 = useState(item.qty ?? 1);
  const [excludedIngredients,      setExcludedIngredients]      = useState(
    () => (item.excludedIngredients || []).map(e => String(e._id || e.id || e))
  );
  const [selectedAddons,           setSelectedAddons]           = useState(
    () => (item.addons || []).map(a => String(a._id || a.id || a.addOnId || a))
  );
  const [componentGroupSelections, setComponentGroupSelections] = useState(
    () => Object.fromEntries(
      (item.componentGroupChoices || []).map(c => [String(c.groupId), String(c.optionId)])
    )
  );
  const [comment, setComment] = useState(item.comment ?? '');

  useEffect(() => {
    if (!item.menuItemId) { setLoading(false); return; }
    getDishDetail(item.menuItemId, getStoredRestaurantId())
      .then(raw => {
        const d = normalizeDish(raw);
        setDish(d);
        // Fill any required groups that aren't yet selected
        if (d?.componentGroups?.length) {
          setComponentGroupSelections(prev => {
            const next = { ...prev };
            for (const g of d.componentGroups) {
              if (next[g.id]) continue;
              const def = g.options.find(o => o.isDefault);
              if (def) next[g.id] = def.id;
            }
            return next;
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [item.menuItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addonPrice = dish
    ? dish.addons.filter(a => selectedAddons.includes(a.id)).reduce((s, a) => s + a.price, 0)
    : 0;
  const groupPrice = dish
    ? Object.entries(componentGroupSelections).reduce((s, [gid, optId]) => {
        const grp = dish.componentGroups.find(g => g.id === gid);
        const opt = grp?.options.find(o => o.id === optId);
        return s + (opt?.priceModifier || 0);
      }, 0)
    : 0;
  const unitPrice = dish ? dish.price + addonPrice + groupPrice : 0;

  const allRequiredFilled = !dish || dish.componentGroups
    .filter(g => g.isRequired)
    .every(g => componentGroupSelections[g.id]);

  async function handleSave() {
    if (!allRequiredFilled || saving) return;
    setSaving(true);
    try {
      await updateOrderItem(orderId, item.id, {
        qty:                   quantity,
        comment,
        excludedIngredients,
        addons:                selectedAddons.map(id => ({ addOnId: id, quantity: 1 })),
        componentGroupChoices: Object.entries(componentGroupSelections).map(([groupId, optionId]) => ({ groupId, optionId })),
      });
      onSaved();
    } catch (err) {
      console.error('DishEditModal save error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={onClose} aria-label="Back">
            <MdArrowBack />
          </button>
          <span className={styles.headerTitle}>
            {loading ? '…' : (dish ? local(dish, 'name') : item.name || '…')}
          </span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <MdClose />
          </button>
        </div>

        {/* Scrollable content */}
        <div className={styles.content}>
          {loading || !dish ? (
            <div className={styles.emptyMsg}>{t('loading')}</div>
          ) : (() => {
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
                      onClick={() => setLbOpen(true)}
                    />
                    {dish.images.length > 1 && (
                      <>
                        <button className={`${styles.imgArrow} ${styles.imgArrowLeft}`}
                          onClick={() => setImgIdx(i => (i - 1 + dish.images.length) % dish.images.length)}>‹</button>
                        <button className={`${styles.imgArrow} ${styles.imgArrowRight}`}
                          onClick={() => setImgIdx(i => (i + 1) % dish.images.length)}>›</button>
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
                    {dishName}{nameFb && <FallbackMark tip={tD('fallback_tooltip')} />}
                  </h2>
                  {dish.weight && <span className={styles.detailWeight}>{dish.weight}</span>}
                  {dishDesc && (
                    <p className={styles.detailDesc}>
                      {dishDesc}{descFb && <FallbackMark tip={tD('fallback_tooltip')} />}
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
          })()}
        </div>

        {/* Footer */}
        {!loading && dish && (
          <div className={styles.footer}>
            <div className={styles.qtyRow}>
              <button className={styles.qtyBtn}
                onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>−</button>
              <span className={styles.qtyVal}>{quantity}</span>
              <button className={styles.qtyBtn}
                onClick={() => setQuantity(q => Math.min(99, q + 1))}>+</button>
            </div>
            <button
              className={styles.addToBasketBtn}
              onClick={handleSave}
              disabled={!allRequiredFilled || saving}
            >
              {saving ? '…' : `${t('saveItem')} · ${(unitPrice * quantity).toFixed(0)}₴`}
            </button>
          </div>
        )}
      </div>

      {dish && (
        <Lightbox
          images={dish.images}
          initialIndex={imgIdx}
          open={lbOpen}
          onClose={() => setLbOpen(false)}
          alt={dish ? local(dish, 'name') : ''}
        />
      )}
    </div>
  );
}
