import apiClient, { getStoredRestaurantId } from './client';

/**
 * GET /:restaurantId/reviews/restaurant
 * Returns { data, pagination, summary: { averageRating, totalCount } }
 */
export async function getRestaurantReviews(restaurantId = getStoredRestaurantId(), page = 1, limit = 20) {
  const res = await apiClient.get(`/${restaurantId}/reviews/restaurant`, {
    params: { page, limit },
  });
  return res.data; // full envelope: { data, pagination, summary }
}

/**
 * GET /:restaurantId/reviews/dish/:menuItemId
 * Returns { data, pagination, summary: { averageRating, totalCount } }
 */
export async function getDishReviews(menuItemId, restaurantId = getStoredRestaurantId(), page = 1, limit = 20) {
  const res = await apiClient.get(`/${restaurantId}/reviews/dish/${menuItemId}`, {
    params: { page, limit },
  });
  return res.data; // full envelope: { data, pagination, summary }
}

/**
 * POST /:restaurantId/reviews/restaurant
 */
export async function submitRestaurantReview(payload, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/reviews/restaurant`, payload);
  return res.data?.data;
}

/**
 * POST /:restaurantId/reviews/dish
 */
export async function submitDishReview(payload, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/reviews/dish`, payload);
  return res.data?.data;
}
