import axios from 'axios';
import { getApiBaseUrl } from './apiBase';

export const ADMIN_UNAUTHORIZED_EVENT = 'ac:admin-unauthorized';

function computeFallbackBaseUrl(baseURL) {
  const b = String(baseURL || '').replace(/\/+$/, '');
  if (!b) return null;
  if (b === '/api') return '';
  if (b.endsWith('/api')) return b.slice(0, -4) || '';
  return null;
}

export function createAdminApi({ token }) {
  const rawBase = getApiBaseUrl();
  const baseURL = rawBase ? rawBase.replace(/\/+$/, '') : '';
  const fallbackBaseURL = computeFallbackBaseUrl(baseURL);

  const api = axios.create({
    baseURL,
    timeout: 30_000
  });

  api.interceptors.request.use((config) => {
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (res) => res,
    (error) => {
      const status = error?.response?.status;
      const message = error?.response?.data?.message;
      const shouldLogout =
        status === 401 || (status === 403 && (message === 'Invalid token' || message === 'Token expired'));
      if (shouldLogout) {
        try {
          window.dispatchEvent(
            new CustomEvent(ADMIN_UNAUTHORIZED_EVENT, {
              detail: { status, message: message || null }
            })
          );
        } catch (e) {
          void e;
        }
      }
      const config = error?.config;
      const method = String(config?.method || '').toLowerCase();
      const canRetry =
        method === 'get' &&
        !config?.__acRetriedWithoutApi &&
        (status === 502 || (status === 404 && (error?.response?.headers?.['server'] || '').includes('nginx')));
      if (canRetry && fallbackBaseURL != null) {
        const nextConfig = { ...(config || {}), baseURL: fallbackBaseURL, __acRetriedWithoutApi: true };
        return api.request(nextConfig);
      }
      return Promise.reject(error);
    }
  );

  return api;
}
