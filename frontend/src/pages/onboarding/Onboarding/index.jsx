import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../../../components/Logo';
import { registerRestaurant } from '../../../api/onboarding';
import styles from './onboarding.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields) {
  const errors = {};
  if (!fields.ownerName.trim() || fields.ownerName.trim().length < 2)
    errors.ownerName = "Ім'я повинно містити мінімум 2 символи";
  if (!fields.restaurantName.trim() || fields.restaurantName.trim().length < 2)
    errors.restaurantName = 'Назва ресторану повинна містити мінімум 2 символи';
  if (!EMAIL_RE.test(fields.email.trim()))
    errors.email = 'Введіть коректну email-адресу';
  return errors;
}

export default function OnboardingPage() {
  const navigate = useNavigate();

  const [fields, setFields] = useState({ ownerName: '', restaurantName: '', email: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner]           = useState(null); // { type, message, action? }
  const [loading, setLoading]         = useState(false);

  // Refs for focus-on-error
  const refs = {
    ownerName:      useRef(null),
    restaurantName: useRef(null),
    email:          useRef(null),
  };

  function handleChange(e) {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    // Clear the field error as soon as the user types
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
    // Clear email-level banner if user modifies the email field
    if (name === 'email' && banner) setBanner(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner(null);

    const errors = validate(fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Focus the first invalid field
      const first = ['ownerName', 'restaurantName', 'email'].find(k => errors[k]);
      if (first) refs[first].current?.focus();
      return;
    }

    setLoading(true);
    try {
      await registerRestaurant({
        ownerName:      fields.ownerName.trim(),
        restaurantName: fields.restaurantName.trim(),
        email:          fields.email.trim(),
      });
      navigate('/onboarding/check-email', { state: { email: fields.email.trim() } });
    } catch (err) {
      const code    = err?.response?.data?.error?.code;
      const message = err?.response?.data?.error?.message;

      if (code === 'ONBOARDING_PENDING') {
        setBanner({
          type: 'warning',
          message: "На цей email вже надіслано посилання. Перевірте папку «Вхідні» або «Спам». Посилання дійсне 24 години.",
          action: { label: "Зареєструватись з іншим email", onClick: () => { setFields({ ownerName: '', restaurantName: '', email: '' }); setBanner(null); refs.ownerName.current?.focus(); } },
        });
      } else if (code === 'EMAIL_TAKEN') {
        setFieldErrors(prev => ({ ...prev, email: 'Цей email вже зареєстровано.' }));
        refs.email.current?.focus();
      } else if (code === 'EMAIL_SEND_FAILED') {
        setBanner({
          type: 'error',
          message: 'Не вдалося надіслати лист підтвердження. Спробуйте пізніше або зверніться до підтримки.',
        });
      } else if (err?.response?.status >= 400 && err?.response?.status < 500) {
        setBanner({ type: 'error', message: message || 'Перевірте введені дані та спробуйте ще раз.' });
      } else {
        setBanner({ type: 'error', message: 'Сталась помилка. Спробуйте ще раз або зверніться до підтримки.' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Logo />
        </div>

        {/* Progress indicator */}
        <div className={styles.progress}>
          <div className={`${styles.progressStep} ${styles.progressStepActive}`}>
            <span className={styles.progressDot}>1</span>
            <span>Заповніть форму</span>
          </div>
          <div className={styles.progressLine} />
          <div className={styles.progressStep}>
            <span className={styles.progressDot}>2</span>
            <span>Підтвердіть email</span>
          </div>
        </div>

        <h1 className={styles.title}>Реєстрація ресторану</h1>
        <p className={styles.subtitle}>Заповніть форму — ми надішлемо посилання для підтвердження на вашу пошту.</p>

        {/* Banner */}
        {banner && (
          <div
            className={`${styles.banner} ${styles[`banner_${banner.type}`]}`}
            role="alert"
          >
            <p className={styles.bannerMsg}>{banner.message}</p>
            {banner.action && (
              <button className={styles.bannerAction} onClick={banner.action.onClick}>
                {banner.action.label}
              </button>
            )}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* ownerName */}
          <div className={styles.field}>
            <label htmlFor="ownerName" className={styles.label}>Ваше ім'я</label>
            <input
              ref={refs.ownerName}
              id="ownerName"
              name="ownerName"
              type="text"
              className={`${styles.input} ${fieldErrors.ownerName ? styles.inputError : ''}`}
              placeholder="Іван Коваль"
              value={fields.ownerName}
              onChange={handleChange}
              autoComplete="name"
              disabled={loading}
            />
            {fieldErrors.ownerName && (
              <span className={styles.fieldError} role="alert">{fieldErrors.ownerName}</span>
            )}
          </div>

          {/* restaurantName */}
          <div className={styles.field}>
            <label htmlFor="restaurantName" className={styles.label}>Назва ресторану</label>
            <input
              ref={refs.restaurantName}
              id="restaurantName"
              name="restaurantName"
              type="text"
              className={`${styles.input} ${fieldErrors.restaurantName ? styles.inputError : ''}`}
              placeholder="Піцерія Сонце"
              value={fields.restaurantName}
              onChange={handleChange}
              autoComplete="organization"
              disabled={loading}
            />
            {fieldErrors.restaurantName && (
              <span className={styles.fieldError} role="alert">{fieldErrors.restaurantName}</span>
            )}
          </div>

          {/* email */}
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              ref={refs.email}
              id="email"
              name="email"
              type="email"
              className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
              placeholder="ivan@example.com"
              value={fields.email}
              onChange={handleChange}
              autoComplete="email"
              disabled={loading}
            />
            {fieldErrors.email && (
              <span className={styles.fieldError} role="alert">
                {fieldErrors.email}{' '}
                {fieldErrors.email.includes('зареєстровано') && (
                  <Link to="/login" className={styles.inlineLink}>Перейти до входу</Link>
                )}
              </span>
            )}
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
            aria-disabled={loading}
          >
            {loading
              ? <><span className={styles.spinner} /> Надсилаємо…</>
              : 'Надіслати посилання для підтвердження'
            }
          </button>
        </form>

        <p className={styles.loginHint}>
          Вже є акаунт?{' '}
          <Link to="/login" className={styles.loginLink}>Увійти</Link>
        </p>
      </div>
    </div>
  );
}
