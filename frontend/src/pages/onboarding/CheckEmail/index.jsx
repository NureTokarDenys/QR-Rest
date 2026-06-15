import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../../../components/Logo';
import { MdMarkEmailRead } from 'react-icons/md';
import styles from './checkEmail.module.css';

export default function CheckEmailPage() {
  const location = useLocation();
  const email    = location.state?.email ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Logo />
        </div>

        <div className={styles.iconWrap}>
          <MdMarkEmailRead className={styles.icon} />
        </div>

        <h1 className={styles.title}>Перевірте пошту</h1>

        <p className={styles.body}>
          Ми надіслали посилання для підтвердження{' '}
          {email
            ? <>на <strong className={styles.emailHighlight}>{email}</strong></>
            : 'на вашу email-адресу'
          }.
          {' '}Натисніть на посилання в листі, щоб завершити реєстрацію.
        </p>

        <p className={styles.validity}>
          Посилання дійсне протягом <strong>24 годин</strong>.
        </p>

        <div className={styles.hint}>
          <span className={styles.hintIcon}>💡</span>
          Не знайшли листа? Перевірте папку «Спам».
        </div>

        <div className={styles.actions}>
          <Link to="/onboarding" className={styles.btnSecondary}>
            Зареєструватись з іншим email
          </Link>
          <Link to="/" className={styles.btnGhost}>
            Повернутись на головну
          </Link>
        </div>
      </div>
    </div>
  );
}
