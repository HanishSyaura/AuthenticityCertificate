import axios from 'axios';

export const ADMIN_UNAUTHORIZED_EVENT = 'ac:admin-unauthorized';

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured !== undefined) {
    const trimmed = String(configured).trim();
    if (!trimmed) return import.meta.env.DEV ? '' : '/api';
    const normalized = trimmed.replace(/\/+$/, '');
    if (import.meta.env.PROD && /^https?:\/\//i.test(normalized)) {
      try {
        const u = new URL(normalized);
        const path = u.pathname.replace(/\/+$/, '');
        if (!path) return `${u.origin}/api`;
      } catch (e) {
        return normalized;
      }
    }
    return normalized;
  }
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return '/api';
}

export function createAdminApi({ token }) {
  const rawBase = getApiBaseUrl();
  const baseURL = rawBase ? rawBase.replace(/\/+$/, '') : '';

  const api = axios.create({
    baseURL,
    timeout: 8000
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
      return Promise.reject(error);
    }
  );

  return api;
}
