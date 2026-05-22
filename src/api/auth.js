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

export async function getMe() {
  const res = await apiClient.get('/auth/me');
  return res.data?.data;
}

/** Update display name. Email changes go through requestEmailChange instead. */
export async function updateProfile(updates) {
  const res = await apiClient.patch('/auth/me', updates);
  return res.data?.data;
}

export async function changePassword(currentPassword, newPassword) {
  const res = await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  return res.data;
}

/** First-time password setup for Google-only accounts (no current password required). */
export async function setPassword(newPassword) {
  const res = await apiClient.post('/auth/set-password', { newPassword });
  return res.data?.data;
}

/** Request a password-reset email. Always resolves (server never confirms email existence). */
export async function forgotPassword(email) {
  const res = await apiClient.post('/auth/forgot-password', { email });
  return res.data;
}

/** Complete a password reset using the token from the email link. */
export async function resetPassword(token, newPassword) {
  const res = await apiClient.post('/auth/reset-password', { token, newPassword });
  return res.data;
}

/** Send a confirmation email to the new address. Throws 409 if email is taken. */
export async function requestEmailChange(newEmail) {
  const res = await apiClient.post('/auth/change-email-request', { newEmail });
  return res.data;
}

/** Activate the new email using the token from the confirmation email. */
export async function confirmEmailChange(token) {
  const res = await apiClient.get('/auth/confirm-email-change', { params: { token } });
  return res.data?.data;
}

/** Permanently delete the current guest account. */
export async function deleteAccount() {
  const res = await apiClient.delete('/auth/account');
  return res.data;
}

export function initiateGoogleOAuth() {
  const base = import.meta.env.VITE_API_URL || '/api';
  window.location.href = `${base}/auth/google`;
}

/** Remove the Google account link (only allowed when the user also has a password). */
export async function unlinkGoogle() {
  const res = await apiClient.delete('/auth/google/unlink');
  return res.data;
}

/**
 * Prepare a Google account link for the currently-authenticated user.
 * Sets a short-lived httpOnly cookie on the backend, then navigates to Google.
 * Must be called while the user is signed in (access token required).
 */
export async function initiateGoogleLink() {
  const base = import.meta.env.VITE_API_URL || '/api';
  // The backend sets the google_link_nonce cookie and returns 200
  await apiClient.post('/auth/google/prepare-link');
  // ?link=1 tells the backend this is a link flow, not a plain login,
  // so it won't clear the google_link_nonce cookie we just set.
  window.location.href = `${base}/auth/google?link=1`;
}
