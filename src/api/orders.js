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

export async function cancelOrder(orderId, reason, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/cancel`, { reason });
  return res.data?.data;
}

export async function voidOrder(orderId, reason, restaurantId = getStoredRestaurantId()) {
  return cancelOrder(orderId, reason, restaurantId);
}

export async function addOrderItems(orderId, items, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/items`, { items });
  return res.data?.data;
}

export async function addGuestOrderItems(orderId, items, sessionToken, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/guest-items`, { sessionToken, items });
  return res.data?.data; // { newGroup, items }
}

export async function cancelGuestOrder(orderId, sessionToken, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/client-cancel`, { sessionToken });
  return res.data?.data;
}

export async function cancelGuestServingGroup(orderId, groupId, sessionToken, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/serving-groups/${groupId}/client-cancel`, { sessionToken });
  return res.data?.data;
}

export async function updateOrderItem(orderId, itemId, data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(`/${restaurantId}/orders/${orderId}/items/${itemId}`, data);
  return res.data?.data;
}

export async function deleteOrderItem(orderId, itemId, restaurantId = getStoredRestaurantId()) {
  await apiClient.delete(`/${restaurantId}/orders/${orderId}/items/${itemId}`);
}

export async function getTableOrders(tableId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/waiter/orders/by-table/${tableId}`);
  return res.data?.data ?? [];
}

export async function waiterCall(orderId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/waiter-call`);
  return res.data?.data;
}

export async function waiterCallCash(orderId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/orders/${orderId}/waiter-call-cash`);
  return res.data?.data;
}

export async function initiatePayment(orderId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/payments/initiate`, { orderId });
  return res.data?.data; // { data, signature, publicKey }
}

export async function getWaiterCalls(params = {}, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/waiter/calls`, { params });
  return res.data?.data ?? [];
}

export async function resolveWaiterCall(callId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(`/${restaurantId}/waiter/calls/${callId}/resolve`);
  return res.data?.data;
}

export async function getOrderNotifications(orderId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/notifications/${orderId}/notifications`);
  return res.data?.data ?? [];
}

export async function markNotificationsRead(orderId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(`/${restaurantId}/notifications/${orderId}/notifications/read-all`);
  return res.data?.data;
}

// Staff opens a 1-minute recovery window so a guest who lost their cookie can re-scan
export async function openTableRecovery(tableId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/waiter/tables/${tableId}/session/recovery`);
  return res.data?.data; // { tableId, tableNumber, recoveryWindowClosesAt }
}
