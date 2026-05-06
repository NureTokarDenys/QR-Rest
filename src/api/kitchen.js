import apiClient, { getStoredRestaurantId } from './client';

export async function getKitchenOrders(view = 'order', restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/kitchen/orders`, { params: { view } });
  return res.data?.data;
}

export async function updateItemStatus(orderId, itemId, status, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(
    `/${restaurantId}/kitchen/orders/${orderId}/items/${itemId}/status`,
    { status }
  );
  return res.data?.data;
}
