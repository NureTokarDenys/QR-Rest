import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/client/Header';
import SettingsSection from '../../../components/client/SettingsSection';
import SettingsRow, { SettingsRowDropdown, ThemeSettingsRow } from '../../../components/client/SettingsRow';
import Footer from '../../../components/client/Footer';
import { useTheme } from '../../../context/ThemeContext';
import styles from './profile.module.css';
import { useTranslation } from 'react-i18next';

import { MdPerson } from "react-icons/md";
import { MdEmail } from "react-icons/md";
import { MdLanguage } from "react-icons/md";
import { MdPalette } from "react-icons/md";
import { MdLock } from "react-icons/md";

export default function Profile() {
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const { t } = useTranslation('profile');

  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <Header title={t('profile_header')} />

      <div className={styles.content}>
        <div className={styles.avatar}>
          <div className={styles.avatarCircle}><MdPerson className={styles.avatarIcon} /></div>
          <p className={styles.email}>alina@email.com</p>
        </div>

        <SettingsSection title={t('orders')}>
          <SettingsRow label={t('my_orders')} value={t('look')} onClick={() => navigate('/order-history')} />
        </SettingsSection>

        <SettingsSection title={t('overall')}>
          <SettingsRow icon={<MdPerson />} label={t('name')} value="Аліна Коваленко" onClick={() => {}} />
          <SettingsRow icon={<MdEmail />} label={t('enail')} value="alina@email.com" onClick={() => {}} />
        </SettingsSection>

        <SettingsSection title={t('settings')}>
         <SettingsRowDropdown
            icon={<MdLanguage />}
              label={t('language')}
              options={[
                { value: 'uk', label: t('ukrainian'), icon: 'UA' },
                { value: 'en', label: t('english'),    icon: 'EN' },
              ]}
              value={i18n.language}
              onChange={(lng) => i18n.changeLanguage(lng)}
          />
         <ThemeSettingsRow icon={<MdPalette />} theme={theme} onThemeChange={setTheme} />
        </SettingsSection>

        <SettingsSection title={t('security')}>
          <SettingsRow icon={<MdLock />} label={t('change_password')} value={t('change')} onClick={() => {}} />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow label={t('logout')} onClick={() => navigate('/login')} danger />
        </SettingsSection>
      </div>

      <Footer />
    </div>
  );
}