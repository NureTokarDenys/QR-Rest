import apiClient, { getStoredRestaurantId } from './client';

/**
 * Fetch the full menu (categories + items) for a restaurant.
 *
 * The restaurant is identified by its publicId in the URL path.
 * When called without an argument the publicId is read from localStorage.
 */
export async function getMenu(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/menu`);
  return res.data?.data;
}

/**
 * Fetch a single menu item by its ID.
 */
export async function getDishDetail(itemId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/menu/items/${itemId}`);
  return res.data?.data;
}

/**
 * Full-text menu search.
 */
export async function searchMenu(q, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/menu/search`, { params: { q } });
  return res.data?.data;
}
