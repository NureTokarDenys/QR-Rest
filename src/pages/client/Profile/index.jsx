import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/client/Header';
import SettingsSection from '../../../components/client/SettingsSection';
import SettingsRow, { SettingsRowDropdown, ThemeSettingsRow } from '../../../components/client/SettingsRow';
import Footer from '../../../components/client/Footer';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import InputField from '../../../components/InputField';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useApp } from '../../../context/AppContext';
import { initiateGoogleOAuth, forgotPassword, requestEmailChange } from '../../../api/auth';
import ConfirmDialog from '../../../components/ConfirmDialog';
import styles from './profile.module.css';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS } from '../../../i18n/langs';

import { MdPerson }        from 'react-icons/md';
import { MdEmail }         from 'react-icons/md';
import { MdLanguage }      from 'react-icons/md';
import { MdPalette }       from 'react-icons/md';
import { MdLock }          from 'react-icons/md';
import { MdDeleteSweep }   from 'react-icons/md';

// Inline Google icon (reuse from login)
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

export default function Profile() {
  const { theme, setTheme }     = useTheme();
  const { i18n }                = useTranslation();
  const { t }                   = useTranslation('profile');
  const navigate                = useNavigate();
  const { user, isAuthenticated, updateProfile, changePassword, logout, deleteAccount } = useAuth();
  const [resetSent,      setResetSent]      = useState(false);
  const [resetSending,   setResetSending]   = useState(false);
  const [resetSendError, setResetSendError] = useState('');
  const { restaurantLangs }     = useApp();

  // ── Confirm dialog ────────────────────────────────
  // dialog: null | 'logout' | 'clearCache'
  const [dialog, setDialog] = useState(null);

  const APP_STORAGE_KEYS = [
    'sessionToken', 'tableId', 'tableNumber',
    'restaurantId', 'restaurantName',
    'orderId', 'activeOrder', 'cartState',
  ];

  function confirmLogout() {
    logout();
    setDialog(null);
  }

  function confirmClearCache() {
    APP_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    window.location.href = '/restaurants';
  }

  // ── Edit sheet state ──────────────────────────────
  const [sheet, setSheet]       = useState(null); // 'name' | 'email' | 'password'
  const [fields, setFields]     = useState({ name: '', currentPw: '', newPw: '', confirmPw: '' });
  const [sheetError, setSheetError] = useState('');
  const [saving, setSaving]     = useState(false);

  // ── Email change flow state ───────────────────────
  const [emailStep,    setEmailStep]    = useState(0); // 0=info 1=input 2=sent
  const [emailInput,   setEmailInput]   = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError,   setEmailError]   = useState('');

  // Show only the languages the restaurant has enabled.
  // If restaurantLangs is empty the restaurant hasn't configured anything yet
  // — fall back to all languages we have frontend support for.
  const activeLangs = restaurantLangs.length > 0 ? restaurantLangs : SUPPORTED_LANGS.map(l => l.code);
  const langOptions = SUPPORTED_LANGS
    .filter(l => activeLangs.includes(l.code))
    .map(l => ({ value: l.code, label: `${l.flag} ${l.label}`, icon: l.code.toUpperCase() }));

  // ── Sheet helpers ─────────────────────────────────

  function openSheet(type) {
    setFields({ name: user?.name || '', currentPw: '', newPw: '', confirmPw: '' });
    setSheetError('');
    setResetSent(false);
    setResetSendError('');
    setEmailStep(0);
    setEmailInput('');
    setEmailError('');
    setSheet(type);
  }

  function closeSheet() {
    setSheet(null);
    setSheetError('');
  }

  function setField(key, val) {
    setFields(prev => ({ ...prev, [key]: val }));
  }

  async function handleSendEmailConfirmation() {
    setEmailError('');
    const addr = emailInput.trim().toLowerCase();
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setEmailError(t('email_invalid'));
      return;
    }
    setEmailSending(true);
    try {
      await requestEmailChange(addr);
      setEmailStep(2);
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      if (code === 'EMAIL_TAKEN') setEmailError(t('email_taken'));
      else setEmailError(t('save_error'));
    } finally {
      setEmailSending(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      await deleteAccount();
    } catch {
      // deleteAccount navigates away; ignore errors
    }
    setDialog(null);
  }

  async function handleSave() {
    setSheetError('');
    setSaving(true);
    try {
      if (sheet === 'name') {
        if (!fields.name.trim()) { setSheetError(t('name_required')); return; }
        await updateProfile({ name: fields.name.trim() });
        closeSheet();

      } else if (sheet === 'password') {
        if (!fields.newPw || fields.newPw.length < 8) { setSheetError(t('password_too_short')); return; }
        if (fields.newPw !== fields.confirmPw) { setSheetError(t('password_mismatch')); return; }
        // currentPw may be blank for Google-only accounts setting a password for the first time
        await changePassword(fields.currentPw, fields.newPw);
        closeSheet();
      }
    } catch (err) {
      const msg = err?.response?.data?.message;
      setSheetError(msg || t('save_error'));
    } finally {
      setSaving(false);
    }
  }

  // ── Shared settings rows (guests can still change language / theme) ──────
  const settingsBlock = (
    <SettingsSection title={t('settings')}>
      <SettingsRowDropdown
        icon={<MdLanguage />}
        label={t('language')}
        options={langOptions}
        value={i18n.language}
        onChange={lng => i18n.changeLanguage(lng)}
      />
      <ThemeSettingsRow icon={<MdPalette />} theme={theme} onThemeChange={setTheme} />
    </SettingsSection>
  );

  // ── Storage / cache section (shown in both guest + auth views) ──────────
  const storageBlock = (
    <SettingsSection title={t('storage')}>
      <SettingsRow
        icon={<MdDeleteSweep />}
        label={t('clear_cache')}
        onClick={() => setDialog('clearCache')}
        danger
      />
    </SettingsSection>
  );

  // ── Dialogs (must render in every return branch) ──────────────────────
  const dialogs = (
    <>
      <ConfirmDialog
        open={dialog === 'logout'}
        title={t('logout_dialog_title')}
        message={t('logout_dialog_message')}
        confirmLabel={t('logout_dialog_confirm')}
        cancelLabel={t('cancel')}
        onConfirm={confirmLogout}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'clearCache'}
        title={t('clear_cache_dialog_title')}
        message={t('clear_cache_dialog_message')}
        confirmLabel={t('clear_cache_dialog_confirm')}
        cancelLabel={t('cancel')}
        onConfirm={confirmClearCache}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'deleteAccount1'}
        title={t('delete_account_dialog1_title')}
        message={t('delete_account_dialog1_message')}
        confirmLabel={t('delete_account_dialog1_confirm')}
        cancelLabel={t('cancel')}
        onConfirm={() => setDialog('deleteAccount2')}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'deleteAccount2'}
        title={t('delete_account_dialog2_title')}
        message={t('delete_account_dialog2_message')}
        confirmLabel={t('delete_account_dialog2_confirm')}
        cancelLabel={t('cancel')}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDialog(null)}
      />
    </>
  );

  // ── Google integration state ─────────────────────
  const hasGoogle   = Boolean(user?.googleId);
  // Google-only = has Google, has no passwordHash (backend may expose this flag)
  const googleOnly  = hasGoogle && !user?.hasPassword;

  // ════════════════════════════════════════════════
  //  GUEST VIEW
  // ════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <div className={styles.page}>
        <Header title={t('profile_header')} />

        <div className={styles.content}>
          <div className={styles.avatar}>
            <div className={styles.avatarCircle}>
              <MdPerson className={styles.avatarIcon} />
            </div>
            <p className={styles.avatarName}>{t('guest')}</p>
          </div>

          <div className={styles.guestSection}>
            <p className={styles.guestMessage}>{t('guest_message')}</p>
            <PrimaryButton label={t('sign_in')} onClick={() => navigate('/login')} />
            <SecondaryButton label={t('create_account')} onClick={() => navigate('/login')} />
          </div>

          {settingsBlock}
          {storageBlock}
        </div>

        {dialogs}
        <Footer />
      </div>
    );
  }

  // ════════════════════════════════════════════════
  //  AUTHENTICATED VIEW
  // ════════════════════════════════════════════════
  return (
    <div className={styles.page}>
      <Header title={t('profile_header')} />

      <div className={styles.content}>
        {/* ── Avatar banner ── */}
        <div className={styles.avatar}>
          <div className={styles.avatarCircle}>
            <MdPerson className={styles.avatarIcon} />
          </div>
          <p className={styles.avatarName}>{user.name || t('guest')}</p>
          {user.email && <p className={styles.avatarEmail}>{user.email}</p>}
        </div>

        {/* ── Orders ── */}
        <SettingsSection title={t('orders')}>
          <SettingsRow label={t('my_orders')} value={t('look')} onClick={() => navigate('/order-history')} />
        </SettingsSection>

        {/* ── Account info ── */}
        <SettingsSection title={t('overall')}>
          <SettingsRow
            icon={<MdPerson />}
            label={t('name')}
            value={user.name || '—'}
            onClick={() => openSheet('name')}
          />
          <SettingsRow
            icon={<MdEmail />}
            label={t('enail')}
            value={user.email || '—'}
            onClick={() => openSheet('email')}
          />
        </SettingsSection>

        {/* ── Security ── */}
        <SettingsSection title={t('security')}>
          {/* Show "Change password" unless it's a Google-only account with no password set yet */}
          {!googleOnly && (
            <SettingsRow
              icon={<MdLock />}
              label={t('change_password')}
              value={t('change')}
              onClick={() => openSheet('password')}
            />
          )}
          {/* Google-only accounts: offer to set a password for the first time */}
          {googleOnly && (
            <SettingsRow
              icon={<MdLock />}
              label={t('set_password')}
              value={t('change')}
              onClick={() => openSheet('password')}
            />
          )}
        </SettingsSection>

        {/* ── Integrations ── */}
        <SettingsSection title={t('integrations')}>
          <SettingsRow
            icon={<GoogleIcon />}
            label={t(hasGoogle ? 'google_connected' : 'google_connect')}
            value={t(hasGoogle ? 'connected' : 'add')}
            onClick={hasGoogle ? undefined : initiateGoogleOAuth}
          />
          {googleOnly && (
            <p className={styles.googleNote}>{t('google_no_password')}</p>
          )}
        </SettingsSection>

        {/* ── App settings ── */}
        {settingsBlock}

        {/* ── Storage ── */}
        {storageBlock}

        {/* ── Logout ── */}
        <SettingsSection>
          <SettingsRow label={t('logout')} onClick={() => setDialog('logout')} danger />
        </SettingsSection>

        {/* ── Delete account (guests only) ── */}
        {user?.role === 'guest' && (
          <SettingsSection>
            <SettingsRow label={t('delete_account')} onClick={() => setDialog('deleteAccount1')} danger />
          </SettingsSection>
        )}
      </div>

      {dialogs}

      {/* ── Edit bottom sheet ── */}
      {sheet && (
        <div className={styles.sheetOverlay} onClick={closeSheet}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <h3 className={styles.sheetTitle}>
              {sheet === 'name'     ? t('edit_name') :
               sheet === 'email'   ? t('email_change_title') :
                                     t('change_password_title')}
            </h3>

            {/* ── Name ── */}
            {sheet === 'name' && (
              <InputField
                label={t('name')}
                value={fields.name}
                onChange={e => setField('name', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            )}

            {/* ── Email – 3-step flow ── */}
            {sheet === 'email' && emailStep === 0 && (
              <div className={styles.resetInfo}>
                <p className={styles.resetInfoText}>{t('email_change_desc')}</p>
              </div>
            )}
            {sheet === 'email' && emailStep === 1 && (
              <>
                <InputField
                  label={t('email_new_label')}
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendEmailConfirmation()}
                />
                {emailError && <p className={styles.sheetError}>{emailError}</p>}
              </>
            )}
            {sheet === 'email' && emailStep === 2 && (
              <div className={styles.resetInfo}>
                <p className={styles.resetSentTitle}>{t('email_change_sent_title')}</p>
                <p className={styles.resetSentBody}>{t('email_change_sent_body', { email: emailInput })}</p>
              </div>
            )}

            {/* ── Password – reset link for regular / set-password form for Google-only ── */}
            {sheet === 'password' && !googleOnly && (
              <div className={styles.resetInfo}>
                {resetSent ? (
                  <>
                    <p className={styles.resetSentTitle}>{t('reset_sent_title')}</p>
                    <p className={styles.resetSentBody}>{t('reset_sent_body', { email: user?.email })}</p>
                  </>
                ) : (
                  <>
                    <p className={styles.resetInfoText}>{t('reset_password_info')}</p>
                    {resetSendError && <p className={styles.sheetError}>{resetSendError}</p>}
                  </>
                )}
              </div>
            )}
            {sheet === 'password' && googleOnly && (
              <>
                <InputField
                  label={t('new_password')}
                  type="password"
                  value={fields.newPw}
                  onChange={e => setField('newPw', e.target.value)}
                />
                <InputField
                  label={t('confirm_password')}
                  type="password"
                  value={fields.confirmPw}
                  onChange={e => setField('confirmPw', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                {sheetError && <p className={styles.sheetError}>{sheetError}</p>}
              </>
            )}

            <div className={styles.sheetActions}>
              {/* Email flow actions */}
              {sheet === 'email' && emailStep === 0 && (
                <>
                  <PrimaryButton label={t('email_change_continue')} onClick={() => setEmailStep(1)} />
                  <SecondaryButton label={t('cancel')} onClick={closeSheet} />
                </>
              )}
              {sheet === 'email' && emailStep === 1 && (
                <>
                  <PrimaryButton
                    label={emailSending ? '...' : t('email_send_confirmation')}
                    onClick={handleSendEmailConfirmation}
                    disabled={emailSending}
                  />
                  <SecondaryButton label={t('cancel')} onClick={() => setEmailStep(0)} />
                </>
              )}
              {sheet === 'email' && emailStep === 2 && (
                <SecondaryButton label={t('cancel')} onClick={closeSheet} />
              )}

              {/* Password sheet – reset link for regular accounts */}
              {sheet === 'password' && !googleOnly && (
                <>
                  {!resetSent && (
                    <PrimaryButton
                      label={resetSending ? '...' : t('send_reset_link')}
                      onClick={async () => {
                        setResetSendError('');
                        setResetSending(true);
                        try {
                          await forgotPassword(user?.email);
                          setResetSent(true);
                        } catch {
                          setResetSendError(t('reset_send_error'));
                        } finally {
                          setResetSending(false);
                        }
                      }}
                      disabled={resetSending}
                    />
                  )}
                  <SecondaryButton label={t('cancel')} onClick={closeSheet} />
                </>
              )}

              {/* Name and Google-only password form */}
              {(sheet === 'name' || (sheet === 'password' && googleOnly)) && (
                <>
                  <PrimaryButton
                    label={saving ? '...' : t('save')}
                    onClick={handleSave}
                    disabled={saving}
                  />
                  <SecondaryButton label={t('cancel')} onClick={closeSheet} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
