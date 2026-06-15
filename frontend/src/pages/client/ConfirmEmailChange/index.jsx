import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../../components/Logo';
import { confirmEmailChange } from '../../../api/auth';
import styles from './confirmEmailChange.module.css';

export default function ConfirmEmailChange() {
  const { t } = useTranslation('confirmEmailChange');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus]   = useState('loading'); // 'loading' | 'success' | 'expired' | 'invalid' | 'taken'
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    confirmEmailChange(token)
      .then(data => {
        setNewEmail(data?.email || '');
        // Sync cached user object so profile shows new email immediately
        try {
          const stored = localStorage.getItem('user');
          if (stored && data?.email) {
            const u = JSON.parse(stored);
            u.email = data.email;
            localStorage.setItem('user', JSON.stringify(u));
          }
        } catch {}
        setStatus('success');
      })
      .catch(err => {
        const code = err?.response?.data?.error?.code;
        if (code === 'TOKEN_EXPIRED') setStatus('expired');
        else if (code === 'EMAIL_TAKEN') setStatus('taken');
        else setStatus('invalid');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function icon() {
    if (status === 'success') return '✅';
    if (status === 'loading') return '⏳';
    return '❌';
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logoSection}><Logo /></div>

        <div className={styles.card}>
          <div className={styles.icon}>{icon()}</div>
          <h2 className={styles.title}>{t(`title_${status}`)}</h2>
          <p className={styles.message}>
            {status === 'success'
              ? t('message_success', { email: newEmail })
              : t(`message_${status}`)}
          </p>
          {status !== 'loading' && (
            <Link to="/profile" className={styles.link}>{t('go_profile')}</Link>
          )}
        </div>
      </div>
    </div>
  );
}
