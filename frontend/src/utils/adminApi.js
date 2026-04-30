import axios from 'axios';

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

  return api;
}
