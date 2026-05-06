import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken'));
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = Boolean(accessToken && user);
  const isStaff = Boolean(user && ['admin', 'waiter', 'cook'].includes(user.role));

  // ── On mount: if a token exists, refresh user data from server so stale
  //    cached profile data is always replaced with the latest.
  useEffect(() => {
    if (!accessToken) return;
    authApi.getMe()
      .then(freshUser => {
        if (freshUser) {
          localStorage.setItem('user', JSON.stringify(freshUser));
          setUser(freshUser);
        }
      })
      .catch(() => {
        // Token invalid — the axios interceptor handles cleanup + redirect.
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync accessToken state when the refresh interceptor writes a new one.
  useEffect(() => {
    function syncToken() {
      const t = localStorage.getItem('accessToken');
      setAccessToken(t);
    }
    window.addEventListener('storage', syncToken);
    return () => window.removeEventListener('storage', syncToken);
  }, []);

  // ─────────────────── auth actions ───────────────────

  async function login(email, password) {
    const data = await authApi.login(email, password);
    const { accessToken: at, refreshToken: rt, user: u } = data;
    _persist(at, rt, u);
    return u;
  }

  /** Clear any existing auth state and proceed as anonymous guest. */
  function loginAsGuest() {
    _clear();
  }

  /**
   * Called by the OAuth callback page after the backend redirects back with tokens.
   * Creates an account if none existed (Google-only: no email, no password).
   */
  function loginFromOAuth(at, rt, u) {
    _persist(at, rt, u);
    return u;
  }

  /** Update name / email. Merges the returned user into state + localStorage. */
  async function updateProfile(updates) {
    const updated = await authApi.updateProfile(updates);
    const merged = { ...user, ...updated };
    localStorage.setItem('user', JSON.stringify(merged));
    setUser(merged);
    return merged;
  }

  async function changePassword(currentPassword, newPassword) {
    return authApi.changePassword(currentPassword, newPassword);
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      _clear();
      window.location.href = '/login';
    }
  }

  // ─────────────────── helpers ───────────────────

  function _persist(at, rt, u) {
    localStorage.setItem('accessToken', at);
    if (rt) localStorage.setItem('refreshToken', rt);
    localStorage.setItem('user', JSON.stringify(u));
    setAccessToken(at);
    setUser(u);
  }

  function _clear() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('orderId');   // prevent next user from inheriting this session's order
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      accessToken, user, isAuthenticated, isStaff,
      login, loginAsGuest, loginFromOAuth,
      updateProfile, changePassword, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
