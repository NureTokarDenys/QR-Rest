import React, { useState, useCallback, useEffect } from 'react';
import { SOUND_KEY } from '../../../hooks/useNotificationSound';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import PageSkeleton from '../../../components/staff/Skeleton';
import InputField from '../../../components/InputField';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import ConfirmDialog from '../../../components/ConfirmDialog';
import styles from './staffSettings.module.css';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { forgotPassword, requestEmailChange, initiateGoogleLink, unlinkGoogle } from '../../../api/auth';
import { MdSettings, MdNotifications, MdEdit, MdCheck, MdClose } from 'react-icons/md';

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function StaffSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation('staffSettings');
  const { t: tErr } = useTranslation('errors');
  const { user, updateProfile, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [lang, setLang]   = useState(i18n.language);
  const [sound, setSound] = useState(() => localStorage.getItem(SOUND_KEY) !== 'false');

  const handleSoundChange = useCallback((val) => {
    setSound(val);
    localStorage.setItem(SOUND_KEY, val ? 'true' : 'false');
  }, []);

  // ── Name editing ──────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false);
  const [name,        setName]        = useState(user?.name || '');
  const [nameSaving,  setNameSaving]  = useState(false);
  const [nameOk,      setNameOk]      = useState(false);
  const [nameError,   setNameError]   = useState('');

  // ── Email change flow ─────────────────────────────
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [emailStep,        setEmailStep]        = useState(0); // 0=hidden 1=input 2=sent
  const [emailInput,       setEmailInput]       = useState('');
  const [emailSending,     setEmailSending]     = useState(false);
  const [emailError,       setEmailError]       = useState('');

  // ── Password reset ────────────────────────────────
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [resetSent,           setResetSent]           = useState(false);
  const [resetSending,        setResetSending]        = useState(false);
  const [resetSendError,      setResetSendError]      = useState('');

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

  // ── Name handlers ─────────────────────────────────
  function startEditName() {
    setName(user?.name || '');
    setNameOk(false);
    setNameError('');
    setNameEditing(true);
  }

  function cancelEditName() {
    setNameEditing(false);
    setName(user?.name || '');
    setNameError('');
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
      setNameEditing(false);
    } catch {
      setNameError(t('nameError'));
    } finally {
      setNameSaving(false);
    }
  }

  // ── Email handlers ────────────────────────────────
  function handleEmailConfirmed() {
    setEmailConfirmOpen(false);
    setEmailInput('');
    setEmailError('');
    setEmailStep(1);
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
      setEmailError(code === 'EMAIL_TAKEN' ? t('emailTaken') : t('emailInvalid'));
    } finally {
      setEmailSending(false);
    }
  }

  // ── Password handlers ─────────────────────────────
  async function handlePasswordConfirmed() {
    setPasswordConfirmOpen(false);
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

  // ── Google ────────────────────────────────────────
  const hasGoogle  = Boolean(user?.hasGoogle);
  const googleOnly = hasGoogle && !user?.hasPassword;

  const [googleLinkOk,    setGoogleLinkOk]    = useState(false);
  const [googleLinkError, setGoogleLinkError] = useState('');
  const [googleLinking,   setGoogleLinking]   = useState(false);
  const [googleUnlinking, setGoogleUnlinking] = useState(false);

  useEffect(() => {
    const linked = searchParams.get('googleLinked');
    const err    = searchParams.get('oauthError');
    if (linked === '1') {
      refreshUser().then(() => setGoogleLinkOk(true));
      setSearchParams({}, { replace: true });
    } else if (err) {
      setGoogleLinkError(tErr(`code.${err}`, { defaultValue: tErr('generic') }));
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGoogleUnlink() {
    setGoogleUnlinking(true);
    setGoogleLinkOk(false);
    setGoogleLinkError('');
    try {
      await unlinkGoogle();
      await refreshUser();
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      setGoogleLinkError(tErr(`code.${code}`, { defaultValue: tErr('generic') }));
    } finally {
      setGoogleUnlinking(false);
    }
  }

  async function handleGoogleLink() {
    setGoogleLinking(true);
    setGoogleLinkOk(false);
    setGoogleLinkError('');
    try {
      await initiateGoogleLink();
    } catch {
      setGoogleLinkError(tErr('generic'));
      setGoogleLinking(false);
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

  const roleLabel = t(`role_${user?.role}`, { defaultValue: user?.role || '—' });

  if (!user) {
    return (
      <StaffShell title={<><MdSettings /> {t('title')}</>}>
        <PageSkeleton variant="settings" sections={2} />
      </StaffShell>
    );
  }

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

          {/* ── User card ── */}
          <div className={styles.userCard}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user?.name || '—'}</p>
              <div className={styles.userMeta}>
                <span className={styles.roleBadge}>{roleLabel}</span>
                <span className={styles.onlineBadge}>● {t('online')}</span>
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            {/* ── Personal data ── */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('personalData')}</p>

              {/* Name – show-only until edit mode */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabel}>{t('name')}</div>
                {nameEditing ? (
                  <div className={styles.nameEditBlock}>
                    <InputField
                      label=""
                      value={name}
                      onChange={e => { setName(e.target.value); setNameOk(false); setNameError(''); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') cancelEditName();
                      }}
                      autoFocus
                    />
                    {nameError && <p className={styles.fieldMsg} style={{ color: '#c0392b' }}>{nameError}</p>}
                    <div className={styles.nameEditActions}>
                      <button className={styles.iconActionBtn} onClick={handleSaveName} disabled={nameSaving} title={t('nameSaveBtn')}>
                        <MdCheck />
                      </button>
                      <button className={styles.iconActionBtn} onClick={cancelEditName} title={t('nameCancelBtn')}>
                        <MdClose />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.fieldValue}>
                    <span className={styles.fieldValueText}>{user?.name || '—'}</span>
                    {nameOk && <span className={styles.fieldOk}>✓</span>}
                    <button className={styles.editIconBtn} onClick={startEditName} title={t('nameEdit')}>
                      <MdEdit />
                    </button>
                  </div>
                )}
              </div>

              <div style={{ height: 4 }} />

              {/* Role (readonly) */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabel}>{t('role')}</div>
                <div className={styles.fieldValueText}>{roleLabel}</div>
              </div>
            </div>

            {/* ── Interface settings ── */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('settingsSection')}</p>
              <Dropdown label={t('interfaceLang')} options={langOptions} value={lang} onChange={handleLangChange} />
              <Dropdown label={t('theme')} options={themeOptions} value={theme} onChange={setTheme} />
              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>
                  <MdNotifications className={styles.notificationIcon} /> {t('soundNotifications')}
                </span>
                <Toggle value={sound} onChange={handleSoundChange} />
              </div>
            </div>
          </div>

          {/* ── Integrations ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('integrationsSection')}</p>

            {hasGoogle ? (
              <>
                <div className={styles.googleAccountCard}>
                  {user.googlePicture ? (
                    <img
                      src={user.googlePicture}
                      alt={user.googleName || 'Google'}
                      className={styles.googleAvatar}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={styles.googleAvatarFallback}>
                      {(user.googleName || user.googleEmail || 'G').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.googleAccountInfo}>
                    {user.googleName  && <span className={styles.googleAccountName}>{user.googleName}</span>}
                    {user.googleEmail && <span className={styles.googleAccountEmail}>{user.googleEmail}</span>}
                  </div>
                  <span className={styles.googleConnectedBadge}>{t('google_connected_value')}</span>
                </div>
                {!googleOnly && (
                  <button
                    className={styles.googleDisconnectRow}
                    onClick={googleUnlinking ? undefined : handleGoogleUnlink}
                    disabled={googleUnlinking}
                  >
                    <span className={styles.googleDisconnectLabel}>{t('google_disconnect')}</span>
                    <span className={styles.googleDisconnectValue}>{googleUnlinking ? '...' : t('disconnect')}</span>
                  </button>
                )}
              </>
            ) : (
              <button
                className={styles.googleConnectRow}
                onClick={googleLinking ? undefined : handleGoogleLink}
                disabled={googleLinking}
              >
                <span className={styles.googleConnectIcon}><GoogleIcon size={18} /></span>
                <span className={styles.googleConnectLabel}>{t('google_connect')}</span>
                <span className={styles.googleConnectValue}>{googleLinking ? '...' : t('google_add')}</span>
              </button>
            )}

            {googleLinkOk    && <p className={styles.googleNote} style={{ color: 'var(--success-color, #4caf50)' }}>{t('google_link_success')}</p>}
            {googleLinkError && <p className={styles.googleNote} style={{ color: 'var(--error-color, #e53935)' }}>{googleLinkError}</p>}
            {googleOnly      && <p className={styles.googleNote}>{t('google_no_password')}</p>}
          </div>

          {/* ── Email change ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('editEmail')}</p>

            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>{t('email')}</div>
              <div className={styles.fieldValue}>
                <span className={styles.fieldValueText}>{user?.email || '—'}</span>
                {emailStep === 0 && (
                  <button className={styles.editIconBtn} onClick={() => setEmailConfirmOpen(true)} title={t('emailChangeContinue')}>
                    <MdEdit />
                  </button>
                )}
              </div>
            </div>

            {emailStep === 1 && (
              <div className={styles.flowBlock}>
                <InputField
                  label={t('emailNewLabel')}
                  type="email"
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSendEmailConfirmation()}
                  autoFocus
                />
                {emailError && <p className={styles.fieldMsg} style={{ color: '#c0392b' }}>{emailError}</p>}
                <div className={styles.flowActions}>
                  <PrimaryButton
                    label={emailSending ? '...' : t('emailSendConfirmation')}
                    onClick={handleSendEmailConfirmation}
                    disabled={emailSending}
                  />
                  <SecondaryButton label={t('cancel')} onClick={() => { setEmailStep(0); setEmailError(''); }} />
                </div>
              </div>
            )}

            {emailStep === 2 && (
              <div className={styles.sentBlock}>
                <p className={styles.sentTitle}>{t('emailChangeSentTitle')}</p>
                <p className={styles.sentBody}>{t('emailChangeSentBody', { email: emailInput })}</p>
              </div>
            )}
          </div>

          {/* ── Password reset ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('changePassword')}</p>

            {resetSent ? (
              <div className={styles.sentBlock}>
                <p className={styles.sentTitle}>{t('resetSentTitle')}</p>
                <p className={styles.sentBody}>{t('resetSentBody')}</p>
              </div>
            ) : (
              <>
                {resetSendError && <p className={styles.fieldMsg} style={{ color: '#c0392b' }}>{resetSendError}</p>}
                {resetSending ? (
                  <p className={styles.sentBody}>...</p>
                ) : (
                  <button
                    className={styles.resetBtn}
                    onClick={() => setPasswordConfirmOpen(true)}
                  >
                    {t('sendResetLink')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Email confirm dialog ── */}
      <ConfirmDialog
        open={emailConfirmOpen}
        title={t('emailChangeConfirmTitle')}
        message={t('emailChangeConfirmMessage')}
        confirmLabel={t('emailChangeContinue')}
        cancelLabel={t('cancel')}
        danger={false}
        onConfirm={handleEmailConfirmed}
        onCancel={() => setEmailConfirmOpen(false)}
      />

      {/* ── Password confirm dialog ── */}
      <ConfirmDialog
        open={passwordConfirmOpen}
        title={t('passwordConfirmTitle')}
        message={t('passwordConfirmMessage', { email: user?.email || '' })}
        confirmLabel={t('passwordConfirm')}
        cancelLabel={t('cancel')}
        danger={false}
        onConfirm={handlePasswordConfirmed}
        onCancel={() => setPasswordConfirmOpen(false)}
      />
    </StaffShell>
  );
}
