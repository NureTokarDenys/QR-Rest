import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import InputField from '../../../components/InputField';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import styles from './staffSettings.module.css';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { forgotPassword, requestEmailChange } from '../../../api/auth';
import { MdSettings, MdNotifications } from 'react-icons/md';

export default function StaffSettings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('staffSettings');
  const { user, updateProfile, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [lang, setLang]     = useState(i18n.language);
  const [sound, setSound]   = useState(true);

  // ── Name editing ──────────────────────────────────
  const [name,        setName]        = useState(user?.name || '');
  const [nameSaving,  setNameSaving]  = useState(false);
  const [nameOk,      setNameOk]      = useState(false);
  const [nameError,   setNameError]   = useState('');

  // ── Email change flow ─────────────────────────────
  const [emailStep,    setEmailStep]    = useState(0); // 0=info 1=input 2=sent
  const [emailInput,   setEmailInput]   = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError,   setEmailError]   = useState('');

  // ── Password reset ────────────────────────────────
  const [resetSent,      setResetSent]      = useState(false);
  const [resetSending,   setResetSending]   = useState(false);
  const [resetSendError, setResetSendError] = useState('');

  const langOptions = [
    { value: 'ua', label: t('lang_ua') },
    { value: 'en', label: t('lang_en') },
  ];
  const themeOptions = [
    { value: 'light', label: t('theme_light') },
    { value: 'dark',  label: t('theme_dark') },
  ];

  function handleLangChange(val) {
    setLang(val);
    i18n.changeLanguage(val);
  }

  async function handleSaveName() {
    setNameError('');
    setNameOk(false);
    if (!name.trim() || name.trim().length < 2) {
      setNameError(t('minNameLength'));
      return;
    }
    setNameSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      setNameOk(true);
    } catch {
      setNameError(t('nameError'));
    } finally {
      setNameSaving(false);
    }
  }

  async function handleSendEmailConfirmation() {
    setEmailError('');
    const addr = emailInput.trim().toLowerCase();
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setEmailError(t('emailInvalid'));
      return;
    }
    setEmailSending(true);
    try {
      await requestEmailChange(addr);
      setEmailStep(2);
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      if (code === 'EMAIL_TAKEN') setEmailError(t('emailTaken'));
      else setEmailError(t('emailInvalid'));
    } finally {
      setEmailSending(false);
    }
  }

  async function handleSendResetLink() {
    setResetSendError('');
    setResetSending(true);
    try {
      await forgotPassword(user?.email);
      setResetSent(true);
    } catch {
      setResetSendError(t('resetSendError'));
    } finally {
      setResetSending(false);
    }
  }

  const Toggle = ({ value, onChange }) => (
    <button
      className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
      onClick={() => onChange(!value)}
    >
      <span className={styles.toggleThumb} />
    </button>
  );

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <StaffShell
      title={<><MdSettings /> {t('title')}</>}
      rightActions={
        <div className={styles.headerActions}>
          <SecondaryButton label={t('logout')} onClick={() => { logout?.(); navigate('/login'); }} className={styles.logoutBtn} />
        </div>
      }
    >
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {/* User card */}
          <div className={styles.userCard}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user?.name || '—'}</p>
              <div className={styles.userMeta}>
                <span className={styles.roleBadge}>{t(`role_${user?.role}`) || user?.role}</span>
                <span className={styles.onlineBadge}>● {t('online')}</span>
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            {/* Personal data – editable */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('personalData')}</p>

              {/* Name */}
              <InputField
                label={t('name')}
                value={name}
                onChange={e => { setName(e.target.value); setNameOk(false); setNameError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              />
              {nameError && <p style={{ color: '#c0392b', fontSize: 13, margin: '0 0 4px' }}>{nameError}</p>}
              {nameOk    && <p style={{ color: '#27ae60', fontSize: 13, margin: '0 0 4px' }}>{t('nameSaved')}</p>}
              <div style={{ width: 160 }}>
                <PrimaryButton
                  label={nameSaving ? '...' : t('saveName')}
                  onClick={handleSaveName}
                  disabled={nameSaving}
                />
              </div>

              <div style={{ height: 8 }} />

              {/* Role (readonly) */}
              <div style={{ fontSize: 13, color: 'var(--secondary-text)', marginBottom: 2 }}>{t('role')}</div>
              <div style={{ fontSize: 15, color: 'var(--primary-text)', fontWeight: 500 }}>
                {t(`role_${user?.role}`) || user?.role || '—'}
              </div>
            </div>

            {/* Interface settings */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('settingsSection')}</p>
              <Dropdown label={t('interfaceLang')} options={langOptions} value={lang} onChange={handleLangChange} />
              <Dropdown label={t('theme')} options={themeOptions} value={theme} onChange={setTheme} />
              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>
                  <MdNotifications className={styles.notificationIcon} /> {t('soundNotifications')}
                </span>
                <Toggle value={sound} onChange={setSound} />
              </div>
            </div>
          </div>

          {/* Email change */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('editEmail')}</p>

            <div style={{ fontSize: 13, color: 'var(--secondary-text)', marginBottom: 4 }}>{t('email')}</div>
            <div style={{ fontSize: 15, color: 'var(--primary-text)', fontWeight: 500, marginBottom: 12 }}>
              {user?.email || '—'}
            </div>

            {emailStep === 0 && (
              <>
                <p style={{ fontSize: 14, color: 'var(--secondary-text)', lineHeight: 1.5, margin: '0 0 12px',
                  padding: 12, background: 'rgba(148,163,184,0.08)', borderRadius: 10,
                  border: '1px solid var(--separator-color)' }}>
                  {t('emailChangeDesc')}
                </p>
                <div style={{ width: 200 }}>
                  <PrimaryButton label={t('emailChangeContinue')} onClick={() => setEmailStep(1)} />
                </div>
              </>
            )}

            {emailStep === 1 && (
              <>
                <InputField
                  label={t('emailNewLabel')}
                  type="email"
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSendEmailConfirmation()}
                />
                {emailError && <p style={{ color: '#c0392b', fontSize: 13, margin: '4px 0' }}>{emailError}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    <PrimaryButton
                      label={emailSending ? '...' : t('emailSendConfirmation')}
                      onClick={handleSendEmailConfirmation}
                      disabled={emailSending}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <SecondaryButton label={t('back')} onClick={() => { setEmailStep(0); setEmailError(''); }} />
                  </div>
                </div>
              </>
            )}

            {emailStep === 2 && (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', margin: '0 0 6px' }}>
                  {t('emailChangeSentTitle')}
                </p>
                <p style={{ fontSize: 14, color: 'var(--secondary-text)', lineHeight: 1.5, margin: 0 }}>
                  {t('emailChangeSentBody', { email: emailInput })}
                </p>
              </>
            )}
          </div>

          {/* Password reset */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('changePassword')}</p>
            {resetSent ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', margin: '0 0 6px' }}>
                  {t('resetSentTitle')}
                </p>
                <p style={{ fontSize: 14, color: 'var(--secondary-text)', lineHeight: 1.5, margin: 0 }}>
                  {t('resetSentBody')}
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--secondary-text)', lineHeight: 1.5, margin: '0 0 12px',
                  padding: 12, background: 'rgba(148,163,184,0.08)', borderRadius: 10,
                  border: '1px solid var(--separator-color)' }}>
                  {t('resetPasswordInfo')}
                </p>
                {resetSendError && (
                  <p style={{ color: '#c0392b', fontSize: 13, margin: '0 0 8px' }}>{resetSendError}</p>
                )}
                <div style={{ width: 200 }}>
                  <PrimaryButton
                    label={resetSending ? '...' : t('sendResetLink')}
                    onClick={handleSendResetLink}
                    disabled={resetSending}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
