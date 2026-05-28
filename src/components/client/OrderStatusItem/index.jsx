import React, { useState } from 'react';
import styles from './orderStatusItem.module.css';
import { useTranslation } from 'react-i18next';
import { MdExpandMore, MdExpandLess, MdClose } from 'react-icons/md';
import ConfirmDialog from '../../ConfirmDialog';

export default function OrderStatusItem({
  orderItemId,
  name,
  quantity = 1,
  lineTotal = null,
  status,
  excludedIngredients = [],
  addons = [],
  componentGroupChoices = [],
  onCancel,
}) {
  const { t, i18n } = useTranslation('orderStatus');
  const [expanded, setExpanded] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const isEn = i18n.language === 'en';
  const canCancel = !!onCancel && status === 'waiting';

  const hasDetails =
    excludedIngredients.length > 0 ||
    addons.length > 0 ||
    componentGroupChoices.length > 0;

  const displayName = quantity > 1 ? `${name} ×${quantity}` : name;
  const priceText   = typeof lineTotal === 'number' ? `₴${lineTotal.toFixed(2)}` : null;

  function ingName(ing) {
    if (typeof ing === 'string') return ing;
    return isEn ? (ing.name_en || ing.name || '') : (ing.name || '');
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await onCancel(orderItemId);
      setOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error?.message || t('cancel_blocked'));
      setLoading(false);
    }
  }

  return (
    <div className={styles.item}>
      <div className={styles.row}>
        <span className={styles.name}>{displayName}</span>
        <div className={styles.right}>
          {priceText && <span className={styles.price}>{priceText}</span>}
          <div className={styles.actions}>
            {hasDetails && (
              <button className={styles.detailsBtn} onClick={() => setExpanded(v => !v)}>
                {expanded
                  ? <><MdExpandLess />{t('item_details_hide')}</>
                  : <><MdExpandMore />{t('item_details_show')}</>}
              </button>
            )}
            {canCancel && (
              <button
                className={styles.cancelTriggerBtn}
                onClick={() => { setError(''); setOpen(true); }}
                aria-label={t('cancel_item')}
              >
                <MdClose />
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && hasDetails && (
        <div className={styles.details}>
          {excludedIngredients.length > 0 && (
            <p className={styles.detailLine}>
              <span className={styles.detailLabel}>{t('item_without')}</span>{' '}
              {excludedIngredients.map((ing, idx) => (
                <span key={idx}>{idx > 0 && ', '}{ingName(ing)}</span>
              ))}
            </p>
          )}
          {addons.length > 0 && (
            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>{t('item_extras')}</span>
              {addons.map((ad, idx) => (
                <span key={idx} className={styles.detailChip}>
                  {isEn ? (ad.name_en || ad.name || '') : (ad.name || '')}
                  {(ad.quantity ?? 1) > 1 && ` ×${ad.quantity}`}
                  {(ad.price ?? 0) > 0 && ` +₴${Number(ad.price).toFixed(2)}`}
                </span>
              ))}
            </div>
          )}
          {componentGroupChoices.length > 0 && (
            <div className={styles.detailSection}>
              <span className={styles.detailLabel}>{t('item_options')}</span>
              {componentGroupChoices.map((ch, idx) => (
                <span key={idx} className={styles.detailChip}>
                  {isEn ? (ch.groupName_en || ch.groupName || '') : (ch.groupName || '')}
                  {': '}
                  {isEn ? (ch.optionName_en || ch.optionName || '') : (ch.optionName || '')}
                  {(ch.priceModifier ?? 0) > 0 && ` +₴${Number(ch.priceModifier).toFixed(2)}`}
                  {(ch.priceModifier ?? 0) < 0 && ` ₴${Number(ch.priceModifier).toFixed(2)}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={open}
        title={t('cancel_item_confirm')}
        error={error}
        confirmLabel={t('cancel_yes')}
        cancelLabel={t('cancel_no')}
        danger
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => { setOpen(false); setError(''); }}
      />
    </div>
  );
}
