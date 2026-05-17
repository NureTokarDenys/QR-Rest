import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';

const SESSION_ERRORS = {
  SESSION_CLOSED: {
    icon:  '✅',
    title: 'Сесію столика завершено',
    body:  'Ця сесія вже закрита. Якщо хочете зробити нове замовлення — зверніться до офіціанта.',
  },
  SESSION_RECOVERY_CLAIMED: {
    icon:  '🔄',
    title: 'Відновлення вже використано',
    body:  'Хтось вже скористався відновленням сесії. Зверніться до офіціанта для нового відновлення.',
  },
};

export default function QrLanding() {
  const { shortCode }   = useParams();
  const { initSession } = useApp();
  const navigate         = useNavigate();

  const [errorCode, setErrorCode] = useState(null);
  const [errorMsg,  setErrorMsg]  = useState('');

  useEffect(() => {
    if (!shortCode) {
      navigate('/restaurants', { replace: true });
      return;
    }

    let cancelled = false;

    initSession(shortCode)
      .then((data) => {
        if (cancelled) return;
        // If the table already has an active order and this guest didn't place it,
        // redirect them directly to the order status view instead of the menu.
        if (data?.tableHasActiveOrder && data?.activeOrderId) {
          navigate(`/order-status/${data.activeOrderId}`, { replace: true });
        } else {
          navigate('/menu', { replace: true });
        }
      })
      .catch(err => {
        if (cancelled) return;
        const code = err?.response?.data?.error?.code;
        if (code && SESSION_ERRORS[code]) {
          setErrorCode(code);
        } else {
          console.error('QR session init error:', err);
          setErrorMsg('Не вдалося розпізнати QR-код. Спробуйте ще раз.');
        }
      });

    return () => { cancelled = true; };
  }, [shortCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (errorCode) {
    const { icon, title, body } = SESSION_ERRORS[errorCode];
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16, padding: 24,
        fontFamily: 'inherit', textAlign: 'center', maxWidth: 400, margin: '0 auto',
      }}>
        <p style={{ fontSize: 52, margin: 0 }}>{icon}</p>
        <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</p>
        <p style={{ fontSize: 15, color: '#555', margin: 0, lineHeight: 1.5 }}>{body}</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16, padding: 24,
        fontFamily: 'inherit', textAlign: 'center',
      }}>
        <p style={{ fontSize: 48 }}>⚠️</p>
        <p style={{ fontSize: 18, fontWeight: 700 }}>{errorMsg}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: '#1d7afc', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 12,
      fontFamily: 'inherit',
    }}>
      <p style={{ fontSize: 32 }}>🍽</p>
      <p style={{ fontSize: 16, color: '#555' }}>Завантаження меню…</p>
    </div>
  );
}
