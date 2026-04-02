import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StaffShell from '../../../components/staff/StaffShell';
import ReadonlyField from '../../../components/staff/ReadonlyField';
import InputField from '../../../components/InputField';
import { Dropdown } from '../../../components/Dropdown';
import PrimaryButton from '../../../components/PrimaryButton';
import SecondaryButton from '../../../components/SecondaryButton';
import { STAFF_USER, NOTIFICATIONS, SHIFT_STATS } from '../../../data/mockData';
import NotificationItem from '../../../components/staff/NotificationItem';
import ShiftStats from '../../../components/staff/ShiftStats';
import styles from './staffSettings.module.css';

export default function StaffSettings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('staffSettings');
  const [lang, setLang] = useState(i18n.language);
  const [theme, setTheme] = useState('light');
  const [sound, setSound] = useState(true);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const langOptions = [
    { value: 'ua', label: 'Українська' },
    { value: 'en', label: 'English' },
  ];
  const themeOptions = [
    { value: 'light', label: 'Світла' },
    { value: 'dark',  label: 'Темна' },
  ];

  function handleLangChange(val) {
    setLang(val);
    i18n.changeLanguage(val);
  }

  function handleThemeChange(val) {
    setTheme(val);
    document.documentElement.setAttribute('data-theme', val === 'dark' ? 'dark' : '');
  }

  const Toggle = ({ value, onChange }) => (
    <button
      className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
      onClick={() => onChange(!value)}
    >
      <span className={styles.toggleThumb} />
    </button>
  );

  return (
    <StaffShell
      title={`⚙️ ${t('title')}`}
      rightActions={
        <div className={styles.headerActions}>
          <PrimaryButton label={t('saveChanges')} onClick={() => {}} />
          <SecondaryButton label={t('logout')} onClick={() => navigate('/login')} />
        </div>
      }
    >
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <div className={styles.userCard}>
            <div className={styles.avatar}>{STAFF_USER.initials}</div>
            <div className={styles.userInfo}>
              <p className={styles.userName}>{STAFF_USER.name}</p>
              <div className={styles.userMeta}>
                <span className={styles.roleBadge}>{t('waiter')}</span>
                <span className={styles.onlineBadge}>● {t('online')}</span>
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('personalData')}</p>
              <ReadonlyField label={t('name')}  value={STAFF_USER.name} />
              <ReadonlyField label={t('email')} value={STAFF_USER.email} />
              <ReadonlyField label={t('role')}  value={t('waiter')} />
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t('settingsSection')}</p>
              <Dropdown label={t('interfaceLang')} options={langOptions} value={lang} onChange={handleLangChange} />
              <Dropdown label={t('theme')} options={themeOptions} value={theme} onChange={handleThemeChange} />
              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>🔔 {t('soundNotifications')}</span>
                <Toggle value={sound} onChange={setSound} />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('changePassword')}</p>
            <div className={styles.grid3}>
              <InputField label={t('currentPassword')} type="password" placeholder="••••••••" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
              <InputField label={t('newPassword')}     type="password" placeholder="••••••••" value={newPwd}     onChange={e => setNewPwd(e.target.value)} />
              <InputField label={t('confirmPassword')} type="password" placeholder="••••••••" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </div>
            <div style={{ width: 160, marginTop: 8 }}>
              <PrimaryButton label={t('changePasswordBtn')} onClick={() => {}} />
            </div>
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.panelSection}>
            <p className={styles.panelTitle}>🔔 Сповіщення</p>
            {NOTIFICATIONS.map(n => <NotificationItem key={n.id} notification={n} />)}
          </div>
          <div className={styles.panelSection}>
            <p className={styles.panelTitle}>📈 Поточна зміна</p>
            <ShiftStats stats={SHIFT_STATS} />
          </div>
        </div>
      </div>
    </StaffShell>
  );
}