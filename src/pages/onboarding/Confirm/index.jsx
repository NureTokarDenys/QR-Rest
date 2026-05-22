import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../../components/Logo';
import { confirmOnboarding } from '../../../api/onboarding';
import { MdCheckCircle, MdError, MdSchedule } from 'react-icons/md';
import styles from './confirm.module.css';

// ── Sub-components ──────────────────────────────────────────────────────────
function LoadingView({ t }) {
  return (
    <div className={styles.stateWrap}>
      <span className={styles.spinner} />
      <p className={styles.stateMsg}>{t('loading_msg')}</p>
    </div>
  );
}

function SuccessView({ data, t }) {
  return (
    <div className={styles.stateWrap}>
      <MdCheckCircle className={`${styles.stateIcon} ${styles.iconSuccess}`} />
      <h2 className={styles.stateTitle}>{t('success_title')}</h2>
      <p className={styles.stateMsg}>
        {t('success_congratulations')}{' '}
        {data?.restaurantName && <strong>{data.restaurantName}</strong>}
        {data?.restaurantId && <> ({data.restaurantId})</>}
        {' '}{t('success_msg_registered')}
      </p>
      <p className={styles.stateSub}>{t('success_sub')}</p>
      <Link to="/login" className={styles.btnPrimary}>
        {t('go_to_login')}
      </Link>
    </div>
  );
}

function ErrorView({ code, t }) {
  const isAlreadyDone = code === 'ALREADY_CONFIRMED';
  const isExpired     = code === 'TOKEN_EXPIRED';

  const errorKey = `error_${code}`;
  const message  = t(errorKey, { defaultValue: t('error_default') });

  return (
    <div className={styles.stateWrap}>
      {isExpired
        ? <MdSchedule className={`${styles.stateIcon} ${styles.iconWarning}`} />
        : <MdError    className={`${styles.stateIcon} ${styles.iconError}`}   />
      }
      <h2 className={styles.stateTitle}>
        {isAlreadyDone ? t('already_confirmed_title') : t('error_title')}
      </h2>
      <p className={styles.stateMsg}>{message}</p>

      {isAlreadyDone
        ? <Link to="/login"      className={styles.btnPrimary}>{t('go_to_login')}</Link>
        : <Link to="/onboarding" className={styles.btnPrimary}>{t('register_again')}</Link>
      }
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ConfirmPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('onboardingConfirm');

  const statusParam = searchParams.get('status');
  const tokenParam  = searchParams.get('token');

  const [state, setState]         = useState('loading');
  const [data, setData]           = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  useEffect(() => {
    if (statusParam === 'success') {
      setData({
        restaurantId:   searchParams.get('restaurantId'),
        restaurantName: searchParams.get('restaurantName'),
      });
      setState('success');
      return;
    }

    if (statusParam === 'error') {
      setErrorCode(searchParams.get('code') ?? 'UNKNOWN');
      setState('error');
      return;
    }

    if (!tokenParam) {
      setErrorCode('INVALID_TOKEN');
      setState('error');
      return;
    }

    let cancelled = false;

    confirmOnboarding(tokenParam)
      .then(body => {
        if (cancelled) return;
        setData({ restaurantId: body.restaurantId, restaurantName: body.restaurantName });
        setState('success');
      })
      .catch(err => {
        if (cancelled) return;
        const code = err?.response?.data?.error?.code ?? 'UNKNOWN';
        setErrorCode(code);
        setState('error');
      });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Logo />
        </div>

        {state === 'loading' && <LoadingView t={t} />}
        {state === 'success' && <SuccessView data={data} t={t} />}
        {state === 'error'   && <ErrorView code={errorCode} t={t} />}

        <div className={styles.footerLinks}>
          <Link to="/"           className={styles.footerLink}>{t('footer_home')}</Link>
          <span className={styles.footerDot}>·</span>
          <Link to="/onboarding" className={styles.footerLink}>{t('footer_register')}</Link>
          <span className={styles.footerDot}>·</span>
          <Link to="/login"      className={styles.footerLink}>{t('footer_login')}</Link>
        </div>
      </div>
    </div>
  );
}
