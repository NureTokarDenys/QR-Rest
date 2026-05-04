import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import styles from './forbidden.module.css';

// Role display config — icon + i18n key
const ROLE_CONFIG = {
  admin:  { icon: '👑', key: 'role_admin' },
  waiter: { icon: '🧑‍💼', key: 'role_waiter' },
  cook:   { icon: '👨‍🍳', key: 'role_cook' },
  guest:  { icon: '👤', key: 'role_guest' },
};

function resolveRoleDisplay(role, t) {
  const cfg = ROLE_CONFIG[role];
  if (cfg) return { icon: cfg.icon, label: t(cfg.key) };
  if (!role) return { icon: '👤', label: t('no_role') };
  return { icon: '❓', label: t('role_unknown') };
}

// Parse "admin,waiter" → ["admin", "waiter"]
function parseRequired(param) {
  if (!param) return [];
  return param.split(',').map(r => r.trim()).filter(Boolean);
}

function buildRequiredLabel(roles, t) {
  if (!roles.length) return { icon: '🛡️', label: t('role_any_staff') };
  if (roles.length === 1) {
    const cfg = ROLE_CONFIG[roles[0]];
    return cfg
      ? { icon: cfg.icon, label: t(cfg.key) }
      : { icon: '❓', label: roles[0] };
  }
  // Multiple roles — join labels
  const labels = roles.map(r => {
    const cfg = ROLE_CONFIG[r];
    return cfg ? t(cfg.key) : r;
  });
  return { icon: '🛡️', label: labels.join(' / ') };
}

export default function Forbidden() {
  const { t } = useTranslation('forbidden');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const requiredRoles = parseRequired(params.get('required'));
  const currentRole = user?.role ?? null;

  const current = resolveRoleDisplay(currentRole, t);
  const required = buildRequiredLabel(requiredRoles, t);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/menu');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Icon */}
        <div className={styles.iconWrap}>
          <span className={styles.icon}>🔒</span>
        </div>

        {/* Heading */}
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>

        {/* Role comparison */}
        <div className={styles.rolesGrid}>
          <div className={`${styles.roleCard} ${styles.current}`}>
            <span className={styles.roleIcon}>{current.icon}</span>
            <span className={styles.roleLabel}>{t('your_role')}</span>
            <span className={styles.roleName}>{current.label}</span>
          </div>

          <div className={styles.arrow}>→</div>

          <div className={`${styles.roleCard} ${styles.required}`}>
            <span className={styles.roleIcon}>{required.icon}</span>
            <span className={styles.roleLabel}>{t('required_role')}</span>
            <span className={styles.roleName}>{required.label}</span>
          </div>
        </div>

        {/* Hint */}
        <p className={styles.hint}>{t('hint')}</p>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={handleBack}>
            ← {t('go_back')}
          </button>
          {!isAuthenticated ? (
            <button className={styles.btnSecondary} onClick={() => navigate('/login')}>
              {t('go_login')}
            </button>
          ) : (
            <button className={styles.btnSecondary} onClick={() => navigate('/menu')}>
              {t('go_menu')}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
