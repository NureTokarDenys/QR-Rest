import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Logo from '../../../components/Logo';
import { confirmOnboarding } from '../../../api/onboarding';
import { MdCheckCircle, MdError, MdSchedule } from 'react-icons/md';
import styles from './confirm.module.css';

// ── Error message map ───────────────────────────────────────────────────────
const ERROR_MESSAGES = {
  INVALID_TOKEN:     'Посилання недійсне. Можливо, ви вже використали його або скопіювали неповністю.',
  ALREADY_CONFIRMED: 'Це посилання вже було використано. Ваш ресторан вже створено. Перейдіть до входу.',
  TOKEN_EXPIRED:     'Термін дії посилання минув (24 години). Зареєструйтесь ще раз.',
};

const DEFAULT_ERROR = 'Сталась помилка при підтвердженні. Спробуйте ще раз або зверніться до підтримки.';

function getErrorMessage(code) {
  return ERROR_MESSAGES[code] ?? DEFAULT_ERROR;
}

// ── Sub-components ──────────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div className={styles.stateWrap}>
      <span className={styles.spinner} />
      <p className={styles.stateMsg}>Підтверджуємо вашу email-адресу…</p>
    </div>
  );
}

function SuccessView({ data }) {
  return (
    <div className={styles.stateWrap}>
      <MdCheckCircle className={`${styles.stateIcon} ${styles.iconSuccess}`} />
      <h2 className={styles.stateTitle}>Ресторан створено!</h2>
      <p className={styles.stateMsg}>
        Вітаємо —{' '}
        {data?.restaurantName && <strong>{data.restaurantName}</strong>}
        {data?.restaurantId && <> ({data.restaurantId})</>}
        {' '}успішно зареєстровано.
      </p>
      <p className={styles.stateSub}>
        Дані для входу (логін і тимчасовий пароль) надіслано на вашу email-адресу.
        Перевірте пошту й увійдіть у систему.
      </p>
      <Link to="/login" className={styles.btnPrimary}>
        Перейти до входу
      </Link>
    </div>
  );
}

function ErrorView({ code }) {
  const isAlreadyDone = code === 'ALREADY_CONFIRMED';
  const isExpired     = code === 'TOKEN_EXPIRED';

  return (
    <div className={styles.stateWrap}>
      {isExpired
        ? <MdSchedule className={`${styles.stateIcon} ${styles.iconWarning}`} />
        : <MdError    className={`${styles.stateIcon} ${styles.iconError}`}   />
      }
      <h2 className={styles.stateTitle}>
        {isAlreadyDone ? 'Вже підтверджено' : 'Помилка підтвердження'}
      </h2>
      <p className={styles.stateMsg}>{getErrorMessage(code)}</p>

      {isAlreadyDone
        ? <Link to="/login"      className={styles.btnPrimary}>Перейти до входу</Link>
        : <Link to="/onboarding" className={styles.btnPrimary}>Зареєструватись знову</Link>
      }
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ConfirmPage() {
  const [searchParams] = useSearchParams();

  // Option A: backend already resolved (redirected here with status=...)
  const statusParam = searchParams.get('status');

  // Option B: frontend makes the API call using the token
  const tokenParam  = searchParams.get('token');

  const [state, setState]       = useState('loading'); // 'loading' | 'success' | 'error'
  const [data, setData]         = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  useEffect(() => {
    // ── Option A: backend redirected with result in query params ───────────
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

    // ── Option B: token in query param — frontend makes the API call ───────
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

        {state === 'loading' && <LoadingView />}
        {state === 'success' && <SuccessView data={data} />}
        {state === 'error'   && <ErrorView code={errorCode} />}

        <div className={styles.footerLinks}>
          <Link to="/"           className={styles.footerLink}>Головна</Link>
          <span className={styles.footerDot}>·</span>
          <Link to="/onboarding" className={styles.footerLink}>Реєстрація</Link>
          <span className={styles.footerDot}>·</span>
          <Link to="/login"      className={styles.footerLink}>Вхід</Link>
        </div>
      </div>
    </div>
  );
}
