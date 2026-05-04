import apiClient from './client';

export async function getMenu(tableId) {
  const params = tableId ? { tableId } : {};
  const res = await apiClient.get('/menu', { params });
  return res.data?.data;
}

export async function getDishDetail(itemId) {
  const res = await apiClient.get(`/menu/items/${itemId}`);
  return res.data?.data;
}

export async function searchMenu(q, tableId) {
  const params = { q };
  if (tableId) params.tableId = tableId;
  const res = await apiClient.get('/menu/search', { params });
  return res.data?.data;
}
