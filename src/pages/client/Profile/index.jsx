import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/Header';
import SettingsSection from '../../../components/SettingsSection';
import SettingsRow, { SettingsRowDropdown, ThemeSettingsRow } from '../../../components/SettingsRow';
import Footer from '../../../components/Footer';
import { useTheme } from '../../../context/ThemeContext';
import styles from './profile.module.css';

import { MdPerson } from "react-icons/md";
import { MdEmail } from "react-icons/md";
import { MdLanguage } from "react-icons/md";
import { MdPalette } from "react-icons/md";
import { MdLock } from "react-icons/md";

export default function Profile() {
  const { theme, setTheme } = useTheme();

  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <Header title="Профіль" />

      <div className={styles.content}>
        <div className={styles.avatar}>
          <div className={styles.avatarCircle}><MdPerson className={styles.avatarIcon} /></div>
          <p className={styles.email}>alina@email.com</p>
        </div>

        <SettingsSection title="Замовлення">
          <SettingsRow label="Мої замовлення" value="Дивитись" onClick={() => navigate('/order-history')} />
        </SettingsSection>

        <SettingsSection title="Загальне">
          <SettingsRow icon={<MdPerson />} label="Ім'я" value="Аліна Коваленко" onClick={() => {}} />
          <SettingsRow icon={<MdEmail />} label="Email" value="alina@email.com" onClick={() => {}} />
        </SettingsSection>

        <SettingsSection title="Налаштування">
         <SettingsRowDropdown
            icon={<MdLanguage />}
              label="Мова"
              options={[
                { value: 'uk', label: 'Українська', icon: '🇺🇦' },
                { value: 'en', label: 'English',    icon: '🇬🇧' },
              ]}
          />
         <ThemeSettingsRow icon={<MdPalette />} theme={theme} onThemeChange={setTheme} />
        </SettingsSection>

        <SettingsSection title="Безпека">
          <SettingsRow icon={<MdLock />} label="Змінити пароль" value="Змінити" onClick={() => {}} />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow label="Вийти з акаунту" onClick={() => navigate('/login')} danger />
        </SettingsSection>
      </div>

      <Footer />
    </div>
  );
}