/**
 * DevToolbar — floating dev-only quick-action panel (top-right corner).
 * Rendered only when import.meta.env.DEV === true.
 *
 * Buttons (top → bottom):
 *   G  – login as guest (clear auth, go to /restaurants)
 *   G1 – login as guest1@example.com → /menu
 *   W  – login as waiter → /staff/map
 *   C  – login as cook  → /staff/cooking
 *   A  – login as admin → /staff/map
 *   C  – clear localStorage + reload  (red)
 *   L  – toggle language (cycles through SUPPORTED_LANGS)
 *   TH – toggle theme (light ↔ dark)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SUPPORTED_LANGS } from '../../i18n/langs';

const STAFF_PASS = '12345678';

const BUTTONS = [
  {
    id: 'guest',
    label: 'G',
    title: 'Login as Guest (anonymous)',
    bg: '#6b7280',
  },
  {
    id: 'guest1',
    label: 'G1',
    title: 'Login as guest1@example.com → /menu',
    bg: '#0891b2',
  },
  {
    id: 'waiter',
    label: 'W',
    title: 'Login as Waiter',
    bg: '#2563eb',
  },
  {
    id: 'cook',
    label: 'C',
    title: 'Login as Cook',
    bg: '#16a34a',
  },
  {
    id: 'admin',
    label: 'A',
    title: 'Login as Admin',
    bg: '#7c3aed',
  },
  {
    id: 'clear',
    label: 'C',
    title: 'Clear localStorage & reload',
    bg: '#dc2626',
  },
  {
    id: 'lang',
    title: 'Toggle language',
    bg: '#d97706',
  },
  {
    id: 'theme',
    label: 'TH',
    title: 'Toggle theme (light ↔ dark)',
    bg: '#374151',
  },
];

// Wrapper ensures the real component (with hooks) is only mounted in DEV mode,
// so the conditional return never breaks the Rules of Hooks.
export default function DevToolbar() {
  if (!import.meta.env.DEV) return null;
  return <DevToolbarInner />;
}

function DevToolbarInner() {
  const navigate = useNavigate();
  const { login, loginAsGuest } = useAuth();
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const [busy, setBusy] = useState(null); // id of in-progress login

  // Current language label for the button (e.g. "UA", "EN")
  const currentLangCode = i18n.language?.toUpperCase() ?? 'UA';

  async function handleClick(id) {
    if (busy) return;

    switch (id) {
      case 'guest': {
        loginAsGuest();
        navigate('/restaurants', { replace: true });
        break;
      }
      case 'guest1': {
        setBusy('guest1');
        try {
          await login('guest1@example.com', STAFF_PASS);
          navigate('/menu', { replace: true });
        } catch (e) {
          console.error('[DevToolbar] guest1 login failed:', e);
        } finally {
          setBusy(null);
        }
        break;
      }
      case 'waiter': {
        setBusy('waiter');
        try {
          await login('waiter1@borshchechok.ua', STAFF_PASS);
          navigate('/staff/map', { replace: true });
        } catch (e) {
          console.error('[DevToolbar] waiter login failed:', e);
        } finally {
          setBusy(null);
        }
        break;
      }
      case 'cook': {
        setBusy('cook');
        try {
          await login('cook1@borshchechok.ua', STAFF_PASS);
          navigate('/staff/cooking', { replace: true });
        } catch (e) {
          console.error('[DevToolbar] cook login failed:', e);
        } finally {
          setBusy(null);
        }
        break;
      }
      case 'admin': {
        setBusy('admin');
        try {
          await login('admin@borshchechok.ua', STAFF_PASS);
          navigate('/staff/map', { replace: true });
        } catch (e) {
          console.error('[DevToolbar] admin login failed:', e);
        } finally {
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
        const currentIdx = codes.indexOf(i18n.language);
        const nextIdx = (currentIdx + 1) % codes.length;
        const nextLang = codes[nextIdx];
        localStorage.setItem('lang', nextLang);
        i18n.changeLanguage(nextLang);
        break;
      }
      case 'theme': {
        setTheme(theme === 'light' ? 'dark' : 'light');
        break;
      }
      default:
        break;
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        pointerEvents: 'auto',
      }}
    >
      {BUTTONS.map((btn) => {
        // The lang button shows the current language code instead of a static label
        const label = btn.id === 'lang' ? currentLangCode : btn.label;
        const fontSize = label && label.length > 2 ? 8 : label && label.length > 1 ? 9 : 13;

        return (
          <button
            key={btn.id}
            title={btn.id === 'lang' ? `Language: ${i18n.language} — click to cycle` : btn.title}
            onClick={() => handleClick(btn.id)}
            disabled={busy !== null && btn.id !== 'clear' && btn.id !== 'lang' && btn.id !== 'theme'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              border: 'none',
              cursor: busy && !['clear', 'lang', 'theme'].includes(btn.id) ? 'not-allowed' : 'pointer',
              background: busy === btn.id ? '#9ca3af' : btn.bg,
              color: '#fff',
              fontSize,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: label && label.length > 1 ? -0.5 : 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
              transition: 'opacity 0.15s',
              opacity: busy && !['clear', 'lang', 'theme'].includes(btn.id) && busy !== btn.id ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            {busy === btn.id ? '…' : label}
          </button>
        );
      })}
    </div>
  );
}
