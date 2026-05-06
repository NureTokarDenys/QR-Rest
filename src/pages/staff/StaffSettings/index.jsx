import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import ReadonlyField from '../../../components/staff/ReadonlyField';
import InputField from '../../../components/InputField';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import styles from './staffSettings.module.css';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { MdSettings, MdNotifications } from "react-icons/md";

export default function StaffSettings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('staffSettings');
  const { user, changePassword, logout } = useAuth();
  const [lang, setLang]           = useState(i18n.language);
  const [sound, setSound]         = useState(true);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError]     = useState('');
  const [pwdOk, setPwdOk]           = useState(false);
  const { theme, setTheme } = useTheme();

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

  async function handleChangePassword() {
    setPwdError('');
    setPwdOk(false);
    if (newPwd !== confirmPwd) { setPwdError(t('passwordMismatch') || 'Passwords do not match'); return; }
    if (newPwd.length < 8)     { setPwdError(t('passwordTooShort') || 'Min 8 characters'); return; }
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setPwdOk(true);
    } catch (err) {
      setPwdError(err?.response?.data?.error?.message || 'Failed to change password');
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
            {/* Personal data */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('personalData')}</p>
              <ReadonlyField label={t('name')}  value={user?.name  || '—'} />
              <ReadonlyField label={t('email')} value={user?.email || '—'} />
              <ReadonlyField label={t('role')}  value={t(`role_${user?.role}`) || user?.role || '—'} />
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

          {/* Change password */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('changePassword')}</p>
            <div className={styles.grid3}>
              <InputField label={t('currentPassword')} type="password" placeholder="••••••••" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
              <InputField label={t('newPassword')}     type="password" placeholder="••••••••" value={newPwd}     onChange={e => setNewPwd(e.target.value)} />
              <InputField label={t('confirmPassword')} type="password" placeholder="••••••••" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </div>
            {pwdError && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 4 }}>{pwdError}</p>}
            {pwdOk    && <p style={{ color: '#27ae60', fontSize: 13, marginTop: 4 }}>{t('passwordChanged') || 'Password changed!'}</p>}
            <div style={{ width: 200, marginTop: 8 }}>
              <PrimaryButton label={t('changePasswordBtn')} onClick={handleChangePassword} />
            </div>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}
