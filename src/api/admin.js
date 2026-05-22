import apiClient, { getStoredRestaurantId } from './client';

// ─── Restaurant ───────────────────────────────────────────────────────────────

export async function getRestaurant(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/restaurant`);
  return res.data?.data;
}

export async function updateRestaurant(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/restaurant`, data);
  return res.data?.data;
}

export async function getLiqpayStatus(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/restaurant/liqpay`);
  return res.data?.data;
}

export async function saveLiqpayKeys(publicKey, privateKey, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/restaurant/liqpay`, { publicKey, privateKey });
  return res.data?.data;
}

export async function uploadRestaurantLogo(file, restaurantId = getStoredRestaurantId()) {
  const form = new FormData();
  form.append('image', file);
  const res = await apiClient.post(`/${restaurantId}/admin/restaurant/logo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data;
}

// ─── Staff management ─────────────────────────────────────────────────────────

export async function getStaff(params = {}, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/staff`, { params });
  return res.data;
}

export async function createStaff(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/staff`, data);
  return res.data?.data;
}

export async function updateStaffRole(userId, role, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/staff/${userId}/role`, { role });
  return res.data?.data;
}

export async function deactivateStaff(userId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/staff/${userId}/deactivate`);
  return res.data?.data;
}

export async function activateStaff(userId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/staff/${userId}/activate`);
  return res.data?.data;
}

export async function resetStaffPassword(userId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/staff/${userId}/reset-password`);
  return res.data?.data;
}

// ─── Admin reviews ────────────────────────────────────────────────────────────

export async function getAdminReviews(params = {}, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/reviews`, { params });
  return res.data;
}

export async function deleteAdminReview(reviewId, type, restaurantId = getStoredRestaurantId()) {
  await apiClient.delete(`/${restaurantId}/admin/reviews/${reviewId}`, { params: { type } });
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export async function getTables(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/tables`);
  return res.data?.data;
}

export async function createTable(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/tables`, data);
  return res.data?.data;
}

export async function updateTable(tableId, data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/tables/${tableId}`, data);
  return res.data?.data;
}

export async function deleteTable(tableId, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.delete(`/${restaurantId}/admin/tables/${tableId}`);
  return res.data?.data;
}

export async function reorderTables(order, restaurantId = getStoredRestaurantId()) {
  // order: [{ id, mapOrder }]
  const res = await apiClient.patch(`/${restaurantId}/admin/tables/reorder`, { order });
  return res.data?.data;
}


// ─── Menu management ──────────────────────────────────────────────────────────

export async function getCategories(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/menu/categories`);
  return res.data?.data;
}

export async function createCategory(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/menu/categories`, data);
  return res.data?.data;
}

export async function updateCategory(id, data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/menu/categories/${id}`, data);
  return res.data?.data;
}

export async function uploadCategoryImage(categoryId, file, restaurantId = getStoredRestaurantId()) {
  const form = new FormData();
  form.append('image', file);
  const res = await apiClient.post(`/${restaurantId}/admin/menu/categories/${categoryId}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data; // { imageUrl, images, selectedImageIdx }
}

export async function setCategoryImages(categoryId, { images, selectedImageIdx }, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/menu/categories/${categoryId}/images`, { images, selectedImageIdx });
  return res.data?.data;
}

export async function getExtras(restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/menu/extras`);
  return res.data?.data;
}

// ─── Global Ingredients ───────────────────────────────────────────────────────

export async function searchIngredients(q = '', restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/menu/ingredients`, { params: q ? { q } : {} });
  return res.data?.data ?? [];
}

export async function createIngredient(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/menu/ingredients`, data);
  return res.data?.data;
}

export async function updateIngredient(id, data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/menu/ingredients/${id}`, data);
  return res.data?.data;
}

export async function deleteIngredient(id, options = {}, restaurantId = getStoredRestaurantId()) {
  const params = options.force ? { force: true } : {};
  await apiClient.delete(`/${restaurantId}/admin/menu/ingredients/${id}`, { params });
}

export async function setIngredientAvailability(id, isAvailable, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(`/${restaurantId}/admin/menu/ingredients/${id}/availability`, { isAvailable });
  return res.data?.data;
}

// ─── Global AddOns ────────────────────────────────────────────────────────────

export async function searchAddons(q = '', restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/menu/addons`, { params: q ? { q } : {} });
  return res.data?.data ?? [];
}

export async function createAddon(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/menu/addons`, data);
  return res.data?.data;
}

export async function updateAddon(id, data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/menu/addons/${id}`, data);
  return res.data?.data;
}

export async function deleteAddon(id, options = {}, restaurantId = getStoredRestaurantId()) {
  const params = options.force ? { force: true } : {};
  await apiClient.delete(`/${restaurantId}/admin/menu/addons/${id}`, { params });
}

export async function setAddonAvailability(id, isAvailable, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(`/${restaurantId}/admin/menu/addons/${id}/availability`, { isAvailable });
  return res.data?.data;
}

// ─── Global ComponentGroups ───────────────────────────────────────────────────

export async function searchComponentGroups(q = '', restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/menu/componentgroups`, { params: q ? { q } : {} });
  return res.data?.data ?? [];
}

export async function createComponentGroup(data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/menu/componentgroups`, data);
  return res.data?.data;
}

export async function updateComponentGroup(id, data, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/menu/componentgroups/${id}`, data);
  return res.data?.data;
}

export async function deleteComponentGroup(id, options = {}, restaurantId = getStoredRestaurantId()) {
  const params = options.force ? { force: true } : {};
  await apiClient.delete(`/${restaurantId}/admin/menu/componentgroups/${id}`, { params });
}

export async function setComponentGroupAvailability(id, isAvailable, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.patch(`/${restaurantId}/admin/menu/componentgroups/${id}/availability`, { isAvailable });
  return res.data?.data;
}

const EXTRA_TYPE_PLURAL = { ingredient: 'ingredients', addon: 'addons', componentgroup: 'componentGroups' };

export async function removeExtraRelation(type, extraId, menuItemId, restaurantId = getStoredRestaurantId()) {
  const apiType = EXTRA_TYPE_PLURAL[type] || type;
  await apiClient.delete(`/${restaurantId}/admin/menu/extras/${apiType}/${extraId}/dishes/${menuItemId}`);
}

export async function getAdminMenuItem(id, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.get(`/${restaurantId}/admin/menu/items/${id}`);
  return res.data?.data;
}

export async function getMenuItems(categoryId, restaurantId = getStoredRestaurantId()) {
  const params = { limit: 9999, ...(categoryId ? { categoryId } : {}) };
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

export async function uploadMenuItemImage(itemId, file, restaurantId = getStoredRestaurantId()) {
  const form = new FormData();
  form.append('image', file);
  const res = await apiClient.post(`/${restaurantId}/admin/menu/items/${itemId}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data; // { imageUrl, images, selectedImageIdx }
}

export async function setMenuItemImages(itemId, { images, selectedImageIdx }, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.put(`/${restaurantId}/admin/menu/items/${itemId}/images`, { images, selectedImageIdx });
  return res.data?.data;
}

// ─── Translation ─────────────────────────────────────────────────────────────

/**
 * Batch-translate an array of strings via the server-side Google Translate proxy.
 * @param {string[]} texts      Source strings (in SOURCE_LANG, i.e. Ukrainian)
 * @param {string}   targetLang Target language code ('en', 'pl', …)
 * @returns {{ translations: string[] }}
 */
export async function translateText(texts, targetLang, restaurantId = getStoredRestaurantId()) {
  const res = await apiClient.post(`/${restaurantId}/admin/translate`, { texts, targetLang });
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

export async function getTopCategories(from, to, restaurantId = getStoredRestaurantId()) {
  const params = {};
  if (from) params.from = from;
  if (to)   params.to   = to;
  const res = await apiClient.get(`/${restaurantId}/admin/analytics/top-categories`, { params });
  return res.data?.data;
}

export async function exportAnalyticsCsv(from, to, restaurantId = getStoredRestaurantId()) {
  const params = {};
  if (from) params.from = from;
  if (to)   params.to   = to;
  const res = await apiClient.get(`/${restaurantId}/admin/analytics/export`, {
    params,
    responseType: 'blob',
  });
  return res.data;
}
