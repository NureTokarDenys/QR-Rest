import apiClient, { getStoredRestaurantId } from './client';

// ─── Tables ───────────────────────────────────────────────────────────────────

export async function getTables(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/tables`);
  return res.data?.data;
}

export async function createTable(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/tables`, data);
  return res.data?.data;
}

// ─── Menu management ──────────────────────────────────────────────────────────

export async function getCategories(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/menu/categories`);
  return res.data?.data;
}

export async function getMenuItems(categoryId, restaurantId = getStoredRestaurantId()) {
  const params = categoryId ? { categoryId } : {};
  const res = await apiClient.get(`/${restaurantId}/admin/menu/items`, { params });
  return res.data?.data;
}

export async function createMenuItem(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/menu/items`, data);
  return res.data?.data;
}

export async function updateMenuItem(id, data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/menu/items/${id}`, data);
  return res.data?.data;
}

export async function deleteMenuItem(id, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.delete(`/${restaurantId}/admin/menu/items/${id}`);
  return res.data?.data;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getRevenue(from, to, restaurantId = getStoredRestaurantId()) {
  const params = {};
  if (from) params.from = from;
  if (to)   params.to   = to;
  const res = await apiClient.get(`/${restaurantId}/admin/analytics/revenue`, { params });
  return res.data?.data;
}

export async function getOrderStats(from, to, restaurantId = getStoredRestaurantId()) {
  const params = {};
  if (from) params.from = from;
  if (to)   params.to   = to;
  const res = await apiClient.get(`/${restaurantId}/admin/analytics/orders`, { params });
  return res.data?.data;
}

export async function getPopularDishes(from, to, restaurantId = getStoredRestaurantId()) {
  const params = {};
  if (from) params.from = from;
  if (to)   params.to   = to;
  const res = await apiClient.get(`/${restaurantId}/admin/analytics/popular-dishes`, { params });
  return res.data?.data;
}
