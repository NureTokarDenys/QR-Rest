import apiClient, { getStoredRestaurantId } from './client';

export async function createOrder(payload, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders`, payload);
  return res.data?.data;
}

export async function getOrder(orderId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/orders/${orderId}`);
  return res.data?.data; // { order, servingGroups, items }
}

/**
 * Returns the authenticated user's recent orders (newest first).
 * This endpoint is global — no restaurant prefix.
 */
export async function getMyOrders(params = {}) {
  const res = await apiClient.get('/user/orders', { params });
  return res.data?.data; // Order[]  (no items embedded — list view only)
}

export async function voidOrder(orderId, reason, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/void`, { reason });
  return res.data?.data;
}

export async function waiterCall(orderId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/waiter-call`);
  return res.data?.data;
}
