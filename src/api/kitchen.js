import apiClient from './client';

export async function getKitchenOrders(view = 'order') {
  const res = await apiClient.get('/kitchen/orders', { params: { view } });
  return res.data?.data;
}

export async function updateItemStatus(orderId, itemId, status) {
  const res = await apiClient.patch(
    `/kitchen/orders/${orderId}/items/${itemId}/status`,
    { status }
  );
  return res.data?.data;
}
