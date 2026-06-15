import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../../components/Logo';
import InputField from '../../../components/InputField';
import PrimaryButton from '../../../components/PrimaryButton';
import { forgotPassword, resetPassword } from '../../../api/auth';
import styles from './forgotPassword.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Email request step ────────────────────────────────────────────────────────

function RequestStep() {
  const { t } = useTranslation('forgotPassword');
  const { t: tErr } = useTranslation('errors');
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit() {
    if (!EMAIL_RE.test(email)) { setError(t('invalid_email')); return; }
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setError(tErr('generic'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.card}>
        <div className={styles.successIcon}>✉️</div>
        <h2 className={styles.title}>{t('sent_title')}</h2>
        <p className={styles.subtitle}>{t('sent_message')}</p>
        <Link to="/login" className={styles.backLink}>{t('back_to_login')}</Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{t('title_request')}</h2>
      <p className={styles.subtitle}>{t('subtitle_request')}</p>

      <div className={styles.form}>
        <InputField
          label={t('email')}
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          onBlur={() => { if (email && !EMAIL_RE.test(email)) setError(t('invalid_email')); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          error={error}
          autoComplete="email"
        />
      </div>

      <PrimaryButton
        label={loading ? '...' : t('send_link')}
        onClick={handleSubmit}
        disabled={loading}
      />

      <Link to="/login" className={styles.backLink}>{t('back_to_login')}</Link>
    </div>
  );
}

// ── Password reset step ───────────────────────────────────────────────────────

function ResetStep({ token }) {
  const { t } = useTranslation('forgotPassword');
  const { t: tErr } = useTranslation('errors');
  const navigate = useNavigate();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  async function handleSubmit() {
    if (password.length < 8)        { setError(t('password_too_short')); return; }
    if (password !== confirm)        { setError(t('password_mismatch'));  return; }
    setError('');
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      setError(tErr(`code.${code}`, { defaultValue: tErr('generic') }));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={styles.card}>
        <div className={styles.successIcon}>✅</div>
        <h2 className={styles.title}>{t('reset_success')}</h2>
        <p className={styles.subtitle}>{t('back_to_login')}…</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{t('title_reset')}</h2>
      <p className={styles.subtitle}>{t('subtitle_reset')}</p>

      <div className={styles.form}>
        <InputField
          label={t('new_password')}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          autoComplete="new-password"
        />
        <InputField
          label={t('confirm_password')}
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoComplete="new-password"
        />
        {error && <p className={styles.errorMsg}>{error}</p>}
      </div>

      <PrimaryButton
        label={loading ? '...' : t('save_password')}
        onClick={handleSubmit}
        disabled={loading}
      />

      <Link to="/login" className={styles.backLink}>{t('back_to_login')}</Link>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function ForgotPassword() {
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <Logo />
        </div>

        {token ? <ResetStep token={token} /> : <RequestStep />}

        <div className={styles.langRow}>
          <button
            className={`${styles.langBtn} ${i18n.language === 'ua' ? styles.langActive : ''}`}
            onClick={() => i18n.changeLanguage('ua')}
          >
            UA
          </button>
          <button
            className={`${styles.langBtn} ${i18n.language === 'en' ? styles.langActive : ''}`}
            onClick={() => i18n.changeLanguage('en')}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}
