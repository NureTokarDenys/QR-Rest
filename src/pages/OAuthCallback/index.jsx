import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Landing page after the backend's Google OAuth redirect.
 *
 * The backend should redirect to:
 *   /auth/callback?accessToken=XXX&refreshToken=YYY&user=<urlencoded-JSON>
 *
 * If something went wrong:
 *   /auth/callback?error=<message>
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const { loginFromOAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error      = params.get('error');
    const at         = params.get('accessToken');
    const rt         = params.get('refreshToken');
    const userParam  = params.get('user');

    if (error) {
      navigate(`/login?oauthError=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (at && userParam) {
      try {
        const u = JSON.parse(decodeURIComponent(userParam));
        const user = loginFromOAuth(at, rt || null, u);
        if (['admin', 'waiter', 'cook'].includes(user?.role)) {
          navigate('/staff/map', { replace: true });
        } else {
          navigate('/menu', { replace: true });
        }
      } catch {
        navigate('/login', { replace: true });
      }
    } else {
      // Nothing in the URL — go back to login.
      navigate('/login', { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      color: 'var(--secondary-text)',
      background: 'var(--bg-color)',
    }}>
      ⏳
    </div>
  );
}
