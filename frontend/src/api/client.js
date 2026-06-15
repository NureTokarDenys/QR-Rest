import axios from 'axios';
import { toApiLang } from '../i18n/langs';

const apiClient = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // needed so Set-Cookie responses (e.g. google_link_nonce) are stored
});

/**
 * Returns the restaurant publicId currently stored in localStorage.
 * Used as a default argument in every restaurant-scoped API function so
 * callers don't have to pass it explicitly every time.
 */
export function getStoredRestaurantId() {
  return localStorage.getItem('restaurantId') || '';
}

// Request interceptor – attach tokens + content language
apiClient.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const sessionToken = localStorage.getItem('sessionToken');
  if (sessionToken) {
    config.headers['X-Session-Token'] = sessionToken;
  }
  // Forward the user's selected language so the backend returns translated
  // dish names, descriptions, ingredients, etc.
  // Maps frontend code ('ua') to backend ISO code ('uk').
  const i18nLang = localStorage.getItem('lang') ?? 'ua';
  config.headers['Accept-Language'] = toApiLang(i18nLang);
  return config;
});

// Flag to prevent infinite refresh loops
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// ─── Error codes that individual pages already handle with their own UI ───────
// These are suppressed from the global toast so the user doesn't see duplicates.
const SUPPRESSED_CODES = new Set([
  'RESTAURANT_NOT_FOUND', // Menu.jsx redirects to /restaurants
]);

/**
 * Dispatch a global api:error event so the HttpErrorToast component can
 * surface the problem without every call-site needing its own try/catch UI.
 *
 * Suppressed:
 *   • 401  — the auth interceptor below handles it (redirect to /login)
 *   • codes in SUPPRESSED_CODES — pages handle these themselves
 *   • cancelled requests (axios CanceledError)
 */
function dispatchApiError(error) {
  // Per-request opt-out: the call-site shows the error in its own UI
  // (e.g. manual table-code entry) and doesn't want a duplicate global toast.
  if (error.config?.skipErrorToast) return;

  if (!error.response) {
    // Network / timeout / cancelled
    if (axios.isCancel(error)) return;
    window.dispatchEvent(new CustomEvent('api:error', {
      detail: { status: 0, code: 'NETWORK_ERROR', message: 'Network error — check your connection.' },
    }));
    return;
  }

  const status = error.response.status;
  // 401 on auth endpoints (login/register) is handled inline by the page.
  // All other 401s are handled by the refresh interceptor above.
  if (status === 401) return;

  const body = error.response.data?.error || error.response.data || {};
  const code = body.code || '';
  if (SUPPRESSED_CODES.has(code)) return;

  const message = body.message || error.message || 'An unexpected error occurred.';

  window.dispatchEvent(new CustomEvent('api:error', {
    detail: { status, code, message },
  }));
}

// Response interceptor – handle 401 / refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Auth endpoints (login, register) returning 401 mean "wrong credentials",
    // not "token expired". Skip the refresh flow so the caller's catch block
    // can display the error instead of causing a hard redirect to /login.
    const isAuthEndpoint = /\/auth\/(login|register)/.test(originalRequest.url ?? '');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
          { refreshToken }
        );
        const newToken = res.data?.data?.accessToken;
        if (newToken) {
          localStorage.setItem('accessToken', newToken);
          apiClient.defaults.headers['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return apiClient(originalRequest);
        }
        throw new Error('No token in refresh response');
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Surface the error globally (skips 401 + suppressed codes)
    dispatchApiError(error);
    return Promise.reject(error);
  }
);

export default apiClient;
