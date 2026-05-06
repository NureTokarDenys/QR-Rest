import apiClient from './client';

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/restaurants — Public restaurant listing
// ═══════════════════════════════════════════════════════════════════════════
//
//  GET /api/restaurants
//  GET /api/restaurants?q=borsh
//  GET /api/restaurants?q=borsh&page=2&limit=10
//
//  Returns:
//  {
//    "data": [{
//      "_id":      "...",
//      "publicId": "BR5CH3OK",   ← use this to prefix ALL restaurant-scoped URLs
//      "name":     "Ресторан Борщечок",
//      "slug":     "borshchechok",
//      "address":  "вул. Сумська 12, Харків",
//      "cuisine":  "Українська",
//      "logoUrl":  null,
//      "isActive": true
//    }],
//    "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
//  }
//
//  After the client selects a restaurant the app stores publicId in
//  localStorage under the key "restaurantId" and prefixes every subsequent
//  restaurant-scoped request:  GET /api/<publicId>/menu,  POST /api/<publicId>/orders, …
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch the public list of active restaurants.
 *
 * @param {string} [q]      - optional search query
 * @param {number} [page=1]
 * @param {number} [limit=20]
 * @returns {Promise<Array>} array of restaurant objects (includes publicId)
 */
export async function getRestaurants(q, page = 1, limit = 20) {
  const params = { page, limit };
  if (q && q.trim()) params.q = q.trim();
  const res = await apiClient.get('/restaurants', { params });
  return res.data?.data ?? [];
}
