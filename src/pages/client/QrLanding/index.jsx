import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../../context/AppContext';

export default function QrLanding() {
  const { shortCode }  = useParams();
  const { initSession } = useApp();
  const navigate        = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shortCode) {
      navigate('/restaurants', { replace: true });
      return;
    }

    let cancelled = false;

    initSession(shortCode)
      .then(() => {
        if (!cancelled) navigate('/menu', { replace: true });
      })
      .catch(err => {
        console.error('QR session init error:', err);
        if (!cancelled) setError('Не вдалося розпізнати QR-код. Спробуйте ще раз.');
      });

    return () => { cancelled = true; };
  }, [shortCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16, padding: 24,
        fontFamily: 'inherit', textAlign: 'center',
      }}>
        <p style={{ fontSize: 48 }}>⚠️</p>
        <p style={{ fontSize: 18, fontWeight: 700 }}>{error}</p>
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
