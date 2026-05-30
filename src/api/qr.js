import apiClient from './client';

export async function scanQR(shortCode, config = {}) {
  const res = await apiClient.get(`/qr/${shortCode}`, config);
  return res.data?.data;
}
