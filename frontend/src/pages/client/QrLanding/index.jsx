import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../../context/AppContext';

const SESSION_ERROR_CODES = new Set(['SESSION_CLOSED', 'SESSION_RECOVERY_CLAIMED']);

export default function QrLanding() {
  const { shortCode }   = useParams();
  const { initSession } = useApp();
  const navigate        = useNavigate();
  const { t }           = useTranslation('qrLanding');

  const [errorCode, setErrorCode] = useState(null);
  const [genericError, setGenericError] = useState(false);

  useEffect(() => {
    if (!shortCode) {
      navigate('/restaurants', { replace: true });
      return;
    }

    let cancelled = false;

    initSession(shortCode)
      .then((data) => {
        if (cancelled) return;
        if (data?.tableHasActiveOrder && data?.activeOrderId) {
          navigate(`/order-status/${data.activeOrderId}`, { replace: true });
        } else {
          navigate('/menu', { replace: true });
        }
      })
      .catch(err => {
        if (cancelled) return;
        const code = err?.response?.data?.error?.code;
        if (code && SESSION_ERROR_CODES.has(code)) {
          setErrorCode(code);
        } else {
          console.error('QR session init error:', err);
          setGenericError(true);
        }
      });

    return () => { cancelled = true; };
  }, [shortCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (errorCode) {
    const titleKey = `${errorCode.toLowerCase()}_title`;
    const bodyKey  = `${errorCode.toLowerCase()}_body`;
    const icon = errorCode === 'SESSION_CLOSED' ? '✅' : '🔄';
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16, padding: 24,
        fontFamily: 'inherit', textAlign: 'center', maxWidth: 400, margin: '0 auto',
      }}>
        <p style={{ fontSize: 52, margin: 0 }}>{icon}</p>
        <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t(titleKey)}</p>
        <p style={{ fontSize: 15, color: '#555', margin: 0, lineHeight: 1.5 }}>{t(bodyKey)}</p>
      </div>
    );
  }

  if (genericError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16, padding: 24,
        fontFamily: 'inherit', textAlign: 'center',
      }}>
        <p style={{ fontSize: 48 }}>⚠️</p>
        <p style={{ fontSize: 18, fontWeight: 700 }}>{t('qr_error')}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: '#1d7afc', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('try_again')}
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
      <p style={{ fontSize: 16, color: '#555' }}>{t('loading')}</p>
    </div>
  );
}
