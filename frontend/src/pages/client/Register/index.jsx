import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../../components/Logo';
import InputField from '../../../components/InputField';
import PrimaryButton from '../../../components/PrimaryButton';
import { useAuth } from '../../../context/AuthContext';
import { register } from '../../../api/auth';
import styles from './register.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { t, i18n } = useTranslation('register');
  const { t: tErr } = useTranslation('errors');
  const navigate     = useNavigate();
  const { isAuthenticated, user, _persist } = useAuth();

  // Redirect already-logged-in users
  useEffect(() => {
    if (isAuthenticated && user) navigate('/', { replace: true });
  }, [isAuthenticated, user, navigate]);

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');

  const [nameError,    setNameError]    = useState('');
  const [emailError,   setEmailError]   = useState('');
  const [passwordError,setPasswordError]= useState('');
  const [confirmError, setConfirmError] = useState('');
  const [serverError,  setServerError]  = useState('');
  const [loading,      setLoading]      = useState(false);

  function validateAll() {
    let ok = true;
    if (!name.trim() || name.trim().length < 2) { setNameError(t('name_too_short')); ok = false; } else setNameError('');
    if (!EMAIL_RE.test(email))                   { setEmailError(t('invalid_email'));  ok = false; } else setEmailError('');
    if (password.length < 8)                     { setPasswordError(t('password_too_short')); ok = false; } else setPasswordError('');
    if (password !== confirm)                    { setConfirmError(t('password_mismatch')); ok = false; } else setConfirmError('');
    return ok;
  }

  async function handleRegister() {
    setServerError('');
    if (!validateAll()) return;
    setLoading(true);
    try {
      const data = await register(email, password, name.trim());
      // Persist auth state the same way login does
      localStorage.setItem('accessToken',  data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user',         JSON.stringify(data.user));
      // Trigger page reload so AuthContext initialises from the new localStorage values
      window.location.href = '/';
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      setServerError(tErr(`code.${code}`, { defaultValue: tErr('generic') }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <Logo />
        </div>

        <div className={styles.card}>
          <h2 className={styles.title}>{t('title')}</h2>
          <p className={styles.subtitle}>{t('subtitle')}</p>

          <div className={styles.form}>
            <InputField
              label={t('name')}
              placeholder="Jane Doe"
              value={name}
              onChange={e => { setName(e.target.value); setNameError(''); }}
              onBlur={() => { if (name && name.trim().length < 2) setNameError(t('name_too_short')); }}
              error={nameError}
              autoComplete="name"
            />
            <InputField
              label={t('email')}
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(''); setServerError(''); }}
              onBlur={() => { if (email && !EMAIL_RE.test(email)) setEmailError(t('invalid_email')); }}
              error={emailError}
              autoComplete="email"
            />
            <InputField
              label={t('password')}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
              onBlur={() => { if (password && password.length < 8) setPasswordError(t('password_too_short')); }}
              error={passwordError}
              autoComplete="new-password"
            />
            <InputField
              label={t('confirm_password')}
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setConfirmError(''); }}
              onBlur={() => { if (confirm && confirm !== password) setConfirmError(t('password_mismatch')); }}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              error={confirmError}
              autoComplete="new-password"
            />
            {serverError && <p className={styles.errorMsg}>{serverError}</p>}
          </div>

          <PrimaryButton
            label={loading ? '...' : t('register')}
            onClick={handleRegister}
            disabled={loading}
          />

          <p className={styles.signInRow}>
            {t('have_account')}{' '}
            <Link to="/login" className={styles.signInLink}>{t('sign_in')}</Link>
          </p>
        </div>

        <div className={styles.langRow}>
          <button
            className={`${styles.langBtn} ${i18n.language === 'ua' ? styles.langActive : ''}`}
            onClick={() => i18n.changeLanguage('ua')}
          >UA</button>
          <button
            className={`${styles.langBtn} ${i18n.language === 'en' ? styles.langActive : ''}`}
            onClick={() => i18n.changeLanguage('en')}
          >EN</button>
        </div>
      </div>
    </div>
  );
}
