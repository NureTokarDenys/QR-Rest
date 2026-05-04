import apiClient from './client';

export async function getTables() {
  const res = await apiClient.get('/admin/tables');
  return res.data?.data;
}

export async function createTable(data) {
  const res = await apiClient.post('/admin/tables', data);
  return res.data?.data;
}

export async function getCategories() {
  const res = await apiClient.get('/admin/menu/categories');
  return res.data?.data;
}

export async function getMenuItems(categoryId) {
  const params = categoryId ? { categoryId } : {};
  const res = await apiClient.get('/admin/menu/items', { params });
  return res.data?.data;
}

export async function createMenuItem(data) {
  const res = await apiClient.post('/admin/menu/items', data);
  return res.data?.data;
}

export async function updateMenuItem(id, data) {
  const res = await apiClient.put(`/admin/menu/items/${id}`, data);
  return res.data?.data;
}

export async function deleteMenuItem(id) {
  const res = await apiClient.delete(`/admin/menu/items/${id}`);
  return res.data?.data;
}

export async function getRevenue(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await apiClient.get('/admin/analytics/revenue', { params });
  return res.data?.data;
}

export async function getOrderStats(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await apiClient.get('/admin/analytics/orders', { params });
  return res.data?.data;
}

export async function getPopularDishes(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await apiClient.get('/admin/analytics/popular-dishes', { params });
  return res.data?.data;
}
