import apiClient, { getStoredRestaurantId } from './client';

export async function getStopList(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/kitchen/extras/stoplist`);
  return res.data?.data ?? [];
}

export async function setEmbeddedItemAvailability(menuItemId, type, subId, isAvailable, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(
    `/${restaurantId}/kitchen/extras/menu/${menuItemId}/${type}/${subId}/availability`,
    { isAvailable }
  );
  return res.data?.data;
}

export async function getKitchenOrders(view = 'order', restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/kitchen/orders`, { params: { view } });
  return res.data?.data;
}

export async function updateGroupStatus(orderId, groupId, status, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(
    `/${restaurantId}/kitchen/orders/${orderId}/groups/${groupId}/status`,
    { status }
  );
  return res.data?.data;
}

export async function updateItemStatus(orderId, itemId, status, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(
    `/${restaurantId}/kitchen/orders/${orderId}/items/${itemId}/status`,
    { status }
  );
  return res.data?.data;
}
