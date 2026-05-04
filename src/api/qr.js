import apiClient from './client';

export async function scanQR(shortCode) {
  const res = await apiClient.get(`/qr/${shortCode}`);
  return res.data?.data;
}
