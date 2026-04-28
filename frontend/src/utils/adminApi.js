import axios from 'axios';

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && String(configured).trim()) return String(configured).trim().replace(/\/+$/, '');
  return 'http://localhost:5000';
}

export function createAdminApi({ token, orgCode }) {
  const api = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 8000
  });

  api.interceptors.request.use((config) => {
    const effectiveOrgCode = orgCode || config?.headers?.['X-Org-Code'] || config?.headers?.['x-org-code'];
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (effectiveOrgCode) {
      config.headers = config.headers || {};
      config.headers['X-Org-Code'] = effectiveOrgCode;
    }
    return config;
  });

  return api;
}
