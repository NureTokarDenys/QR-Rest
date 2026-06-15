import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdStar, MdCheckCircle, MdClose } from 'react-icons/md';
import styles from './upgradeModal.module.css';
import { initiateSubscription, getSubscriptionPrice } from '../../api/subscriptions';

const PREMIUM_FEATURES = [
  'upgrade_feature_unlimited_menu',
  'upgrade_feature_unlimited_staff',
  'upgrade_feature_liqpay',
  'upgrade_feature_analytics',
  'upgrade_feature_reviews',
  'upgrade_feature_pdf',
  'upgrade_feature_translate',
];

const LIQPAY_CHECKOUT = 'https://www.liqpay.ua/api/3/checkout';

/**
 * UpgradeModal
 * @param {boolean}  open       – whether to show the modal
 * @param {function} onClose    – called when user dismisses
 * @param {string}   [reason]   – optional reason key from components ns
 * @param {string}   [ns]       – i18n namespace (default: 'components')
 */
export default function UpgradeModal({ open, onClose, reason, ns = 'components' }) {
  const { t } = useTranslation(ns);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [price,   setPrice]   = useState(null); // { amount, currency }

  // Fetch the live subscription price once the modal opens. Single source of
  // truth lives on the backend (subscriptions.js) so we never drift.
  useEffect(() => {
    if (!open || price) return;
    let cancelled = false;
    getSubscriptionPrice()
      .then(p => { if (!cancelled && p) setPrice(p); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, price]);

  if (!open) return null;

  const reasonText = reason
    ? (t(reason, { defaultValue: reason }) || reason)
    : null;

  async function handleUpgrade() {
    setLoading(true);
    setError('');
    try {
      const { data, signature, publicKey } = await initiateSubscription();

      // Submit a hidden form to LiqPay hosted checkout
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = LIQPAY_CHECKOUT;
      form.style.display = 'none';

      [['data', data], ['signature', signature]].forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type  = 'hidden';
        input.name  = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      sessionStorage.setItem('payment_pending', '1');
      form.submit();
    } catch (err) {
      setError(t('upgrade_error', { defaultValue: 'Payment initiation failed. Please try again.' }));
      setLoading(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <span className={styles.badge}>
          <MdStar />
          {t('upgrade_badge')}
        </span>

        <h2 className={styles.title}>{t('upgrade_title')}</h2>

        {reasonText && (
          <p className={styles.reason}>{reasonText}</p>
        )}

        <p className={styles.featuresLabel}>{t('upgrade_features_label')}</p>

        <ul className={styles.features}>
          {PREMIUM_FEATURES.map(key => (
            <li key={key} className={styles.feature}>
              <MdCheckCircle className={styles.featureIcon} />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.actions}>
          <button
            className={styles.btnUpgrade}
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading
              ? t('upgrade_loading', { defaultValue: 'Processing…' })
              : t('upgrade_cta', { price: price?.amount ?? '—' })}
          </button>
          <button className={styles.btnClose} onClick={onClose} disabled={loading}>
            {t('upgrade_close')}
          </button>
        </div>
      </div>
    </div>
  );
}
