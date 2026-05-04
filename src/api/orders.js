import apiClient from './client';

export async function createOrder(payload) {
  const res = await apiClient.post('/orders', payload);
  return res.data?.data;
}

export async function getOrder(orderId) {
  const res = await apiClient.get(`/orders/${orderId}`);
  return res.data?.data;
}

export async function voidOrder(orderId, reason) {
  const res = await apiClient.post(`/orders/${orderId}/void`, { reason });
  return res.data?.data;
}

export async function waiterCall(orderId) {
  const res = await apiClient.post(`/orders/${orderId}/waiter-call`);
  return res.data?.data;
}
