import apiClient, { getStoredRestaurantId } from './client';

export async function initiateSubscription(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/subscriptions/initiate`);
  return res.data?.data;
}

export async function getSubscriptionPrice(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/subscriptions/price`);
  return res.data?.data; // { amount, currency, periodicity }
}

export async function cancelSubscription(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/subscriptions/cancel`);
  return res.data?.data;
}
