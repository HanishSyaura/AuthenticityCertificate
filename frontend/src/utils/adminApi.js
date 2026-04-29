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

export function createAdminApi({ token }) {
  const rawBase = getApiBaseUrl();
  const baseURL = rawBase ? rawBase.replace(/\/+$/, '') : '';
  const baseHasApi = baseURL === '/api' || baseURL.endsWith('/api');

  const api = axios.create({
    baseURL,
    timeout: 8000
  });

  api.interceptors.request.use((config) => {
    if (!baseHasApi && typeof config.url === 'string' && config.url.startsWith('/') && !config.url.startsWith('/api/')) {
      config.url = `/api${config.url}`;
    }
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return api;
}
