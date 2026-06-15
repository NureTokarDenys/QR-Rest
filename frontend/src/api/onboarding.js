import apiClient from './client';

/**
 * POST /onboarding/register
 * Sends a confirmation email to the prospective restaurant owner.
 */
export async function registerRestaurant(payload) {
  const res = await apiClient.post('/onboarding/register', payload);
  return res.data?.data;
}

/**
 * GET /onboarding/confirm/:token
 * Validates the email confirmation token and creates the restaurant + admin user.
 * Returns { message, restaurantId, restaurantName } on success.
 */
export async function confirmOnboarding(token) {
  const res = await apiClient.get(`/onboarding/confirm/${token}`);
  return res.data?.data;
}
