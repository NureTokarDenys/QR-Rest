import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import InputField from '../../components/InputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import styles from './login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <Logo />
          <p className={styles.subtitle}>Замовляйте без очікування</p>
        </div>

        <div className={styles.form}>
          <InputField
            label="Email"
            placeholder="email@example.com"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <InputField
            label="Пароль"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <PrimaryButton label="Увійти" onClick={() => navigate('/staff')} />
          <div className={styles.divider}><span>Або</span></div>
          <SecondaryButton label="Гостьовий вхід" onClick={() => navigate('/menu')} />
        </div>

        <div className={styles.langRow}>
          <button className={`${styles.langBtn} ${styles.langActive}`}>UA</button>
          <button className={styles.langBtn}>EN</button>
        </div>
      </div>
    </div>
  );
}