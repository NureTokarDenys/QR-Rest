/**
 * DevToolbar — floating dev-only quick-action panel (center-right).
 * Rendered only when import.meta.env.DEV === true.
 *
 * Two-column grid layout (left = free restaurant, right = premium):
 *   G   G1  — guest anon / guest1@example.com → /menu
 *   WF  WP  — waiter (free) / waiter (premium) → /staff/map
 *   CF  CP  — cook  (free) / cook  (premium)   → /staff/cooking
 *   AF  AP  — admin (free) / admin (premium)   → /staff/map
 *   LG  TH  — cycle language / toggle theme
 *   C       — clear localStorage + reload  (red, full-width)
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useStaffNotifications } from '../../context/StaffNotificationsContext';
import { SUPPORTED_LANGS } from '../../i18n/langs';

const STAFF_PASS = '12345678';

const GRID_BUTTONS = [
  // [left, right] per row
  [
    { id: 'guest',    label: 'G',  title: 'Guest (anonymous) → /restaurants',   bg: '#6b7280' },
    { id: 'guest1',   label: 'G1', title: 'guest1@example.com → /menu',         bg: '#0891b2' },
  ],
  [
    { id: 'waiter_f', label: 'WF', title: 'Waiter — Free (borshchechok)',        bg: '#2563eb' },
    { id: 'waiter_p', label: 'WP', title: 'Waiter — Premium',                   bg: '#1d4ed8' },
  ],
  [
    { id: 'cook_f',   label: 'CF', title: 'Cook — Free (borshchechok)',          bg: '#16a34a' },
    { id: 'cook_p',   label: 'CP', title: 'Cook — Premium',                     bg: '#15803d' },
  ],
  [
    { id: 'admin_f',  label: 'AF', title: 'Admin — Free (borshchechok)',         bg: '#7c3aed' },
    { id: 'admin_p',  label: 'AP', title: 'Admin — Premium',                    bg: '#6d28d9' },
  ],
  [
    { id: 'lang',     label: null, title: 'Cycle language',                      bg: '#d97706' },
    { id: 'theme',    label: 'TH', title: 'Toggle theme (light ↔ dark)',         bg: '#374151' },
  ],
];

const CLEAR_BUTTON = { id: 'clear', label: 'C', title: 'Clear localStorage & reload', bg: '#dc2626' };

export default function DevToolbar() {
  if (!import.meta.env.DEV) return null;
  return <DevToolbarInner />;
}

function DevToolbarInner() {
  const [visible, setVisible] = useState(true);
  const { login, loginAsGuest } = useAuth();
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const { fireTestNotification } = useStaffNotifications();
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'F8') {
        e.preventDefault();
        setVisible(v => !v);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentLangLabel = i18n.language?.toUpperCase() ?? 'UA';

  async function handleClick(id) {
    if (busy) return;

    switch (id) {
      case 'guest': {
        loginAsGuest();
        window.location.replace('/restaurants');
        break;
      }
      case 'guest1': {
        setBusy('guest1');
        try {
          await login('guest1@example.com', STAFF_PASS);
          window.location.replace('/menu');
        } catch (e) {
          console.error('[DevToolbar] guest1 login failed:', e);
          setBusy(null);
        }
        break;
      }
      case 'waiter_f': {
        setBusy('waiter_f');
        try {
          await login('waiter1@borshchechok.ua', STAFF_PASS);
          window.location.replace('/staff/map');
        } catch (e) {
          console.error('[DevToolbar] waiter_f login failed:', e);
          setBusy(null);
        }
        break;
      }
      case 'waiter_p': {
        setBusy('waiter_p');
        try {
          await login('waiter1@premium.ua', STAFF_PASS);
          window.location.replace('/staff/map');
        } catch (e) {
          console.error('[DevToolbar] waiter_p login failed:', e);
          setBusy(null);
        }
        break;
      }
      case 'cook_f': {
        setBusy('cook_f');
        try {
          await login('cook1@borshchechok.ua', STAFF_PASS);
          window.location.replace('/staff/cooking');
        } catch (e) {
          console.error('[DevToolbar] cook_f login failed:', e);
          setBusy(null);
        }
        break;
      }
      case 'cook_p': {
        setBusy('cook_p');
        try {
          await login('cook1@premium.ua', STAFF_PASS);
          window.location.replace('/staff/cooking');
        } catch (e) {
          console.error('[DevToolbar] cook_p login failed:', e);
          setBusy(null);
        }
        break;
      }
      case 'admin_f': {
        setBusy('admin_f');
        try {
          await login('admin@borshchechok.ua', STAFF_PASS);
          window.location.replace('/staff/map');
        } catch (e) {
          console.error('[DevToolbar] admin_f login failed:', e);
          setBusy(null);
        }
        break;
      }
      case 'admin_p': {
        setBusy('admin_p');
        try {
          await login('admin@premium.ua', STAFF_PASS);
          window.location.replace('/staff/map');
        } catch (e) {
          console.error('[DevToolbar] admin_p login failed:', e);
          setBusy(null);
        }
        break;
      }
      case 'clear': {
        localStorage.clear();
        window.location.reload();
        break;
      }
      case 'lang': {
        const codes = SUPPORTED_LANGS.map(l => l.code);
        const nextLang = codes[(codes.indexOf(i18n.language) + 1) % codes.length];
        localStorage.setItem('lang', nextLang);
        i18n.changeLanguage(nextLang);
        break;
      }
      case 'theme': {
        setTheme(theme === 'light' ? 'dark' : 'light');
        break;
      }
      case 'notif': {
        fireTestNotification();
        break;
      }
      default: break;
    }
  }

  if (!visible) return null;

  const isUtil = id => ['clear', 'lang', 'theme'].includes(id);

  function renderBtn(btn) {
    const label = btn.id === 'lang' ? currentLangLabel : btn.label;
    const fontSize = label && label.length > 2 ? 8 : label && label.length > 1 ? 9 : 13;
    const isBusy = busy === btn.id;
    const isDisabled = busy !== null && !isUtil(btn.id);

    return (
      <button
        key={btn.id}
        title={btn.id === 'lang' ? `Language: ${i18n.language} — click to cycle` : btn.title}
        onClick={() => handleClick(btn.id)}
        disabled={isDisabled}
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          border: 'none',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          background: isBusy ? '#9ca3af' : btn.bg,
          color: '#fff',
          fontSize,
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: label && label.length > 1 ? -0.5 : 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          transition: 'opacity 0.15s',
          opacity: isDisabled && !isBusy ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        {isBusy ? '…' : label}
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        right: 12,
        transform: 'translateY(-50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        pointerEvents: 'auto',
      }}
    >
      {/* 2-column grid rows */}
      {GRID_BUTTONS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 4 }}>
          {row.map(btn => renderBtn(btn))}
        </div>
      ))}

      {/* 🔔 Fake notification — full-width, cycles through all event types */}
      <button
        title="Fire mock notification (cycles ORDER_NEW → WAITER_CALL → WAITER_CALL_CASH → …)"
        onClick={() => handleClick('notif')}
        style={{
          width: 76,
          height: 28,
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: '#b45309',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'monospace',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          userSelect: 'none',
        }}
      >
        🔔
      </button>

      {/* Clear — full-width below the grid */}
      <button
        title={CLEAR_BUTTON.title}
        onClick={() => handleClick('clear')}
        style={{
          width: 76,
          height: 28,
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: CLEAR_BUTTON.bg,
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'monospace',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          userSelect: 'none',
        }}
      >
        {CLEAR_BUTTON.label}
      </button>
    </div>
  );
}
