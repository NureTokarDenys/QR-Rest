import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { waiterCallCash, initiatePayment, checkCardAvailable } from '../../../api/orders';
import {
  MdPayments, MdCreditCard, MdClose, MdCheckCircle, MdArrowBack, MdWarning, MdErrorOutline,
} from 'react-icons/md';
import styles from './paymentSheet.module.css';

/**
 * PaymentSheet — "Pay Now" button that opens a bottom sheet.
 *
 * Props:
 *   orderId   — active order id
 *   isFree    — true for free-plan restaurants (hides LiqPay)
 *   allServed — true when every dish in the order is already served
 *
 * Step flow:
 *   All served:     options → cashConfirm → cashSent
 *                   options → [card check] → cardConfirm → (LiqPay redirect)
 *   Not all served: options → warn → cashConfirm → cashSent
 *                   options → [card check] → warn → cardConfirm → (LiqPay redirect)
 *   Card unavail:   options → [card check] → cardError
 */
export default function PaymentSheet({ orderId, isFree, allServed = false, amount }) {
  const { t } = useTranslation('orderStatus');
  const formattedAmount = amount != null && !isNaN(Number(amount))
    ? `₴${Number(amount).toFixed(2)}`
    : null;

  const [open, setOpen]                   = useState(false);
  const [step, setStep]                   = useState('options');
  const [warnTarget, setWarnTarget]       = useState(null); // 'cashConfirm' | 'cardConfirm'
  const [cardErrorReason, setCardError]   = useState(null); // reason string
  const [cardChecking, setCardChecking]   = useState(false);
  const [liqpayLoading, setLiqpay]        = useState(false);
  const [cashLoading, setCashLoading]     = useState(false);

  function openSheet() {
    setStep('options');
    setWarnTarget(null);
    setCardError(null);
    setOpen(true);
  }

  function closeSheet() {
    setOpen(false);
    setTimeout(() => { setStep('options'); setWarnTarget(null); setCardError(null); }, 300);
  }

  // ── Cash: no check needed, go straight to warn or confirm ────────────────
  function handleCashClick() {
    if (!allServed) {
      setWarnTarget('cashConfirm');
      setStep('warn');
    } else {
      setStep('cashConfirm');
    }
  }

  // ── Card: validate credentials first, then proceed ────────────────────────
  async function handleCardClick() {
    if (cardChecking) return;
    setCardChecking(true);
    try {
      const status = await checkCardAvailable();
      if (!status?.available) {
        setCardError(status?.reason || 'unavailable');
        setStep('cardError');
        return;
      }
      if (!allServed) {
        setWarnTarget('cardConfirm');
        setStep('warn');
      } else {
        setStep('cardConfirm');
      }
    } catch (_) {
      // Network error — let the user try; the /initiate endpoint will catch it
      if (!allServed) {
        setWarnTarget('cardConfirm');
        setStep('warn');
      } else {
        setStep('cardConfirm');
      }
    } finally {
      setCardChecking(false);
    }
  }

  function proceedFromWarn() {
    setStep(warnTarget);
  }

  async function handleLiqPay() {
    if (liqpayLoading) return;
    setLiqpay(true);
    try {
      const payload = await initiatePayment(orderId);
      if (!payload?.data || !payload?.signature) { setLiqpay(false); return; }
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://www.liqpay.ua/api/3/checkout';
      form.acceptCharset = 'utf-8';
      const di = document.createElement('input');
      di.type = 'hidden'; di.name = 'data'; di.value = payload.data;
      const si = document.createElement('input');
      si.type = 'hidden'; si.name = 'signature'; si.value = payload.signature;
      form.appendChild(di); form.appendChild(si);
      document.body.appendChild(form);
      form.submit();
    } catch (_) {
      setLiqpay(false);
    }
  }

  async function handleCashCall() {
    if (cashLoading) return;
    setCashLoading(true);
    try {
      await waiterCallCash(orderId);
      setStep('cashSent');
      setTimeout(() => { closeSheet(); setCashLoading(false); }, 3000);
    } catch (_) {
      setCashLoading(false);
    }
  }

  // Map reason → i18n key
  function cardErrorKey(reason) {
    if (reason === 'not_configured')    return 'pay_card_not_configured';
    if (reason === 'invalid_credentials') return 'pay_card_invalid_credentials';
    return 'pay_card_unavailable';
  }

  return (
    <>
      <button className={styles.payNowBtn} onClick={openSheet}>
        <MdPayments />
        {t('pay_now')}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className={styles.overlay} onClick={closeSheet} />

          {/* Bottom sheet */}
          <div className={styles.sheet}>
            <div className={styles.sheetHandle} />

            {/* ── Options list ── */}
            {step === 'options' && (
              <>
                <div className={styles.sheetHeader}>
                  <span className={styles.sheetTitle}>{t('pay_method_title')}</span>
                  <button className={styles.sheetClose} onClick={closeSheet} aria-label="Close">
                    <MdClose />
                  </button>
                </div>

                {formattedAmount && (
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>{t('pay_total')}</span>
                    <span className={styles.totalAmount}>{formattedAmount}</span>
                  </div>
                )}

                {/* Cash row */}
                <button className={styles.methodRow} onClick={handleCashClick}>
                  <div className={styles.methodIcon}>
                    <MdPayments />
                  </div>
                  <div className={styles.methodInfo}>
                    <span className={styles.methodLabel}>{t('pay_cash_label')}</span>
                    <span className={styles.methodDesc}>{t('pay_cash_desc')}</span>
                  </div>
                </button>

                {/* Card row — premium only */}
                {!isFree && (
                  <button
                    className={`${styles.methodRow} ${cardChecking ? styles.methodRowChecking : ''}`}
                    onClick={handleCardClick}
                    disabled={cardChecking}
                  >
                    <div className={`${styles.methodIcon} ${styles.methodIconCard}`}>
                      {cardChecking ? <span className={styles.methodSpinner} /> : <MdCreditCard />}
                    </div>
                    <div className={styles.methodInfo}>
                      <span className={styles.methodLabel}>{t('pay_card_label')}</span>
                      <span className={styles.methodDesc}>
                        {cardChecking ? t('pay_card_checking') : t('pay_card_desc')}
                      </span>
                    </div>
                  </button>
                )}
              </>
            )}

            {/* ── ⚠️ Warning step (dishes not all served) ── */}
            {step === 'warn' && (
              <div className={styles.warnBlock}>
                <button className={styles.backBtn} onClick={() => setStep('options')}>
                  <MdArrowBack /> {t('pay_back')}
                </button>
                <div className={styles.warnIcon}>
                  <MdWarning />
                </div>
                <p className={styles.warnTitle}>{t('pay_warn_title')}</p>
                <p className={styles.warnBody}>{t('pay_warn_body')}</p>
                {formattedAmount && (
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>{t('pay_total')}</span>
                    <span className={styles.totalAmount}>{formattedAmount}</span>
                  </div>
                )}
                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={closeSheet}>{t('cancel_no')}</button>
                  <button className={styles.warnProceedBtn} onClick={proceedFromWarn}>
                    {t('pay_warn_proceed')}
                  </button>
                </div>
              </div>
            )}

            {/* ── ❌ Card error step ── */}
            {step === 'cardError' && (
              <div className={styles.cardErrorBlock}>
                <div className={styles.cardErrorIcon}>
                  <MdErrorOutline />
                </div>
                <p className={styles.cardErrorText}>{t(cardErrorKey(cardErrorReason))}</p>
                <button className={styles.cardErrorBackBtn} onClick={() => setStep('options')}>
                  <MdArrowBack /> {t('pay_card_error_back')}
                </button>
              </div>
            )}

            {/* ── Cash confirmation ── */}
            {step === 'cashConfirm' && (
              <div className={styles.confirmBlock}>
                <button className={styles.backBtn} onClick={() => setStep(allServed ? 'options' : 'warn')}>
                  <MdArrowBack /> {t('pay_back')}
                </button>
                <p className={styles.confirmText}>{t('pay_cash_confirm')}</p>
                {formattedAmount && (
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>{t('pay_total')}</span>
                    <span className={styles.totalAmount}>{formattedAmount}</span>
                  </div>
                )}
                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={closeSheet}>{t('cancel_no')}</button>
                  <button
                    className={styles.confirmBtn}
                    onClick={handleCashCall}
                    disabled={cashLoading}
                  >
                    {cashLoading ? '…' : t('pay_confirm_yes')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Card confirmation ── */}
            {step === 'cardConfirm' && (
              <div className={styles.confirmBlock}>
                <button className={styles.backBtn} onClick={() => setStep(allServed ? 'options' : 'warn')}>
                  <MdArrowBack /> {t('pay_back')}
                </button>
                <p className={styles.confirmText}>{t('pay_card_confirm')}</p>
                {formattedAmount && (
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>{t('pay_total')}</span>
                    <span className={styles.totalAmount}>{formattedAmount}</span>
                  </div>
                )}
                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={closeSheet}>{t('cancel_no')}</button>
                  <button
                    className={styles.confirmBtn}
                    onClick={handleLiqPay}
                    disabled={liqpayLoading}
                  >
                    {liqpayLoading ? '…' : t('pay_confirm_yes')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Cash sent / success state ── */}
            {step === 'cashSent' && (
              <div className={styles.sentBlock}>
                <MdCheckCircle className={styles.sentIcon} />
                <p className={styles.sentText}>{t('cash_call_sent')}</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
