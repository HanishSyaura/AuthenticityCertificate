import axios from 'axios';
import { getApiBaseUrl } from './apiBase';

export const ADMIN_UNAUTHORIZED_EVENT = 'ac:admin-unauthorized';

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
