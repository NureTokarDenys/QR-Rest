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
