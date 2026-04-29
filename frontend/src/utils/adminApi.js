import axios from 'axios';

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured !== undefined) {
    const trimmed = String(configured).trim();
    if (trimmed) return trimmed.replace(/\/+$/, '');
    return '';
  }
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return '';
}

function getAdminApiBaseUrl() {
  const base = getApiBaseUrl();
  if (!base) return '/api';
  if (base.endsWith('/api')) return base;
  return `${base}/api`;
}

export function createAdminApi({ token }) {
  const api = axios.create({
    baseURL: getAdminApiBaseUrl(),
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
