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

  const isAuthenticated = Boolean(accessToken);
  const isStaff = Boolean(user && ['admin', 'waiter', 'cook'].includes(user.role));

  async function login(email, password) {
    const data = await authApi.login(email, password);
    const { accessToken: at, refreshToken: rt, user: u } = data;
    localStorage.setItem('accessToken', at);
    localStorage.setItem('refreshToken', rt);
    localStorage.setItem('user', JSON.stringify(u));
    setAccessToken(at);
    setUser(u);
    return u;
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setAccessToken(null);
      setUser(null);
      window.location.href = '/login';
    }
  }

  // Sync state if localStorage changes from refresh interceptor
  useEffect(() => {
    function syncToken() {
      const t = localStorage.getItem('accessToken');
      setAccessToken(t);
    }
    window.addEventListener('storage', syncToken);
    return () => window.removeEventListener('storage', syncToken);
  }, []);

  return (
    <AuthContext.Provider value={{ accessToken, user, isAuthenticated, isStaff, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
