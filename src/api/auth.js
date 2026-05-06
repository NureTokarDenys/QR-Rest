import apiClient from './client';

export async function login(email, password) {
  const res = await apiClient.post('/auth/login', { email, password });
  return res.data?.data;
}

export async function register(email, password, name) {
  const res = await apiClient.post('/auth/register', { email, password, name });
  return res.data?.data;
}

export async function logout() {
  const res = await apiClient.post('/auth/logout');
  return res.data;
}

export async function refreshToken() {
  const token = localStorage.getItem('refreshToken');
  const res = await apiClient.post('/auth/refresh', { refreshToken: token });
  return res.data?.data;
}

/** Fetch current user from server (used on app boot to restore fresh data). */
export async function getMe() {
  const res = await apiClient.get('/auth/me');
  return res.data?.data;
}

/** Update name / email (patch only supplied fields). */
export async function updateProfile(updates) {
  const res = await apiClient.patch('/auth/me', updates);
  return res.data?.data;
}

/** Change password. currentPassword may be empty for Google-only accounts setting a password for the first time. */
export async function changePassword(currentPassword, newPassword) {
  const res = await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  return res.data;
}

/** Redirect the browser to the backend Google OAuth entry point. */
export function initiateGoogleOAuth() {
  const base = import.meta.env.VITE_API_URL || '/api';
  const callback = encodeURIComponent(`${window.location.origin}/auth/callback`);
  window.location.href = `${base}/auth/google?redirect=${callback}`;
}
