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

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured !== undefined) {
    const trimmed = String(configured).trim();
    if (!trimmed) return import.meta.env.DEV ? '' : '/api';
    const normalized = stripTrailingSlashes(trimmed);
    const upgraded = isAbsoluteUrl(normalized) ? stripTrailingSlashes(maybeUpgradeToHttps(normalized)) : normalized;
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

export function resolveApiAssetUrl(urlOrPath) {
  const raw = String(urlOrPath || '').trim();
  if (!raw) return '';
  if (isAbsoluteUrl(raw)) return maybeUpgradeToHttps(raw);
  if (!raw.startsWith('/')) return raw;

  const apiBase = stripTrailingSlashes(getApiBaseUrl());
  if (!apiBase || !isAbsoluteUrl(apiBase)) return raw;

  try {
    const u = new URL(apiBase);
    return `${u.origin}${raw}`;
  } catch {
    return raw;
  }
}

export function resolvePublicMediaUrl(urlOrPath) {
  const raw = String(urlOrPath || '').trim();
  if (!raw) return '';

  if (isAbsoluteUrl(raw)) {
    try {
      const u = new URL(raw);
      if (u.pathname.startsWith('/api/uploads/')) u.pathname = u.pathname.replace(/^\/api\/uploads\//, '/uploads/');
      return maybeUpgradeToHttps(u.toString());
    } catch {
      return maybeUpgradeToHttps(raw);
    }
  }

  const normalized = raw.startsWith('/api/uploads/') ? raw.replace(/^\/api\/uploads\//, '/uploads/') : raw;
  return resolveApiAssetUrl(normalized);
}
