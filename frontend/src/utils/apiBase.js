function stripTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/, '');
}

function maybeUpgradeToHttps(urlString) {
  if (typeof window === 'undefined') return urlString;
  if (window.location?.protocol !== 'https:') return urlString;
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'http:') return urlString;
    if (u.hostname !== window.location.hostname) return urlString;
    u.protocol = 'https:';
    return u.toString();
  } catch {
    return urlString;
  }
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured !== undefined) {
    const trimmed = String(configured).trim();
    if (!trimmed) return import.meta.env.DEV ? '' : '/api';
    const normalized = stripTrailingSlashes(trimmed);
    const upgraded = /^https?:\/\//i.test(normalized) ? stripTrailingSlashes(maybeUpgradeToHttps(normalized)) : normalized;
    if (import.meta.env.PROD && /^https?:\/\//i.test(upgraded)) {
      try {
        const u = new URL(upgraded);
        const path = stripTrailingSlashes(u.pathname);
        if (!path || path === '/') {
          u.pathname = '/api';
          u.search = '';
          u.hash = '';
          return stripTrailingSlashes(u.toString());
        }
      } catch {
        return upgraded;
      }
    }
    return upgraded;
  }
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return '/api';
}

export function getPublicApiBaseUrl() {
  const baseURL = stripTrailingSlashes(getApiBaseUrl());
  if (!baseURL) return '/public';
  return `${baseURL}/public`;
}
