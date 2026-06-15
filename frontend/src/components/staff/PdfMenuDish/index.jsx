import React from 'react';
import { useTranslation } from 'react-i18next';
import { SOURCE_LANG, fieldFor } from '../../../i18n/langs';
import styles from './pdfMenuDish.module.css';

/**
 * Render a single dish row for the PDF preview.
 *
 *   - settings: visibility toggles + image config (passed from the generator)
 *   - lang:     explicit language code ('ua' | 'en' | ...). Decoupled from the
 *               UI i18n so bilingual mode can render the same dish twice in
 *               different languages.
 *   - categoryName: pre-localised category label (badge)
 *   - rating:   { rating, reviewCount } when reviews are enabled
 *
 * All visual styling (colours, fonts, separators) is driven by CSS variables
 * declared on the parent `.previewDoc` element, so the templates and the
 * user-customisable colour pickers can both feed into the same surface.
 */
function pickLocalized(obj, field, lang) {
  if (!obj) return '';
  if (lang === SOURCE_LANG) return obj[field] || '';
  return obj[fieldFor(field, lang)] || obj[field] || '';
}

export default function PdfMenuDish({ dish, settings, lang, categoryName, rating }) {
  const { t } = useTranslation('components');
  const local = (obj, field) => pickLocalized(obj, field, lang);

  const images = Array.isArray(dish.images) && dish.images.length > 0
    ? dish.images.slice(0, Math.max(1, settings.maxImages || 1))
    : (dish.image ? [dish.image] : []);

  // Smart image layout — chosen automatically per dish:
  //   no photo setting → none
  //   0 images        → placeholder
  //   1 / gallery off → single side photo
  //   2-3            → main + thumbnail column
  //   4+             → main + horizontal strip
  let imgMode = 'none';
  if (settings.showMainPhoto) {
    if (images.length === 0)                                  imgMode = 'placeholder';
    else if (images.length === 1 || !settings.showGallery)    imgMode = 'single';
    else if (images.length <= 3)                              imgMode = 'thumbs';
    else                                                      imgMode = 'strip';
  }

  const ingredients = (dish.ingredientsList     || []).map(i => local(i, 'name')).filter(Boolean);
  const addons      = (dish.addonsList          || []).map(a => ({ name: local(a, 'name'), price: a.price }));
  const groups      = (dish.componentGroupsList || []).map(g => ({
    name:    local(g, 'name'),
    options: (g.options || []).map(o => local(o, 'name')).filter(Boolean),
  }));

  const description = local(dish, 'description');
  const weight      = local(dish, 'weight') || dish.weight;
  const showRating  = settings.showReviews && rating && (rating.reviewCount > 0 || rating.rating);

  return (
    <div className={styles.row}>
      {/* ── Images ─────────────────────────────────────────────────────────── */}
      {imgMode === 'placeholder' && (
        <div className={styles.imgPlaceholder}>🍽</div>
      )}
      {imgMode === 'single' && (
        <img src={images[0]} alt="" className={styles.img} />
      )}
      {imgMode === 'thumbs' && (
        <div className={styles.imgThumbsBlock}>
          <img src={images[0]} alt="" className={styles.img} />
          <div className={styles.thumbsCol}>
            {images.slice(1).map((url, i) => (
              <img key={i} src={url} alt="" className={styles.thumb} />
            ))}
          </div>
        </div>
      )}
      {imgMode === 'strip' && (
        <div className={styles.imgStripBlock}>
          <img src={images[0]} alt="" className={styles.imgLarge} />
          <div className={styles.thumbsStrip}>
            {images.slice(1).map((url, i) => (
              <img key={i} src={url} alt="" className={styles.thumbStrip} />
            ))}
          </div>
        </div>
      )}

      {/* ── Text block ─────────────────────────────────────────────────────── */}
      <div className={styles.info}>
        <div className={styles.top}>
          <span className={styles.name}>
            {local(dish, 'name')}
            {settings.showCategoryBadge && categoryName && (
              <span className={styles.catBadge}>{categoryName}</span>
            )}
          </span>
          <span className={styles.price}>
            {dish.price} {t('currency_symbol', '₴')}
          </span>
        </div>

        {(settings.showWeight && weight) && (
          <span className={styles.weight}>{weight}</span>
        )}

        {showRating && (
          <span className={styles.rating}>
            {'★'.repeat(Math.round(rating.rating || 0))}
            {'☆'.repeat(5 - Math.round(rating.rating || 0))}
            <span className={styles.ratingMeta}>
              {' '}{rating.rating?.toFixed(1) || '—'} ({rating.reviewCount || 0})
            </span>
          </span>
        )}

        {settings.showDescription && description && (
          <p className={styles.desc}>{description}</p>
        )}

        {settings.showIngredients && ingredients.length > 0 && (
          <p className={styles.meta}>{ingredients.join(' · ')}</p>
        )}

        {settings.showAddons && addons.length > 0 && (
          <ul className={styles.addonList}>
            {addons.map((a, i) => (
              <li key={i}>+ {a.name} <span className={styles.addonPrice}>+{a.price}₴</span></li>
            ))}
          </ul>
        )}

        {settings.showComponentGroups && groups.length > 0 && (
          <div className={styles.groupBlock}>
            {groups.map((g, i) => (
              <div key={i} className={styles.groupLine}>
                <span className={styles.groupName}>{g.name}:</span>{' '}
                {g.options.join(', ')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
