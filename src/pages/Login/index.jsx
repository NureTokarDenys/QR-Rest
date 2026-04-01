import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import styles from './login.module.css';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { i18n } = useTranslation();
  const { t } = useTranslation('login');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <Logo />
          <p className={styles.subtitle}>{t('slogan')}</p>
        </div>

        <div className={styles.form}>
          <InputField
            label={t('email')}

            placeholder="email@example.com"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <InputField
            label={t('password')}
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <PrimaryButton label={t('login')} onClick={() => navigate('/staff')} />
          <div className={styles.divider}><span>{t('or')}</span></div>
          <SecondaryButton label={t('guest_mode')} onClick={() => navigate('/menu')} />
        </div>

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