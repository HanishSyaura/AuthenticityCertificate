import { resolvePublicMediaUrl } from './apiBase';

export const DEFAULT_APP_TITLE = 'Zora Pro PAC';

export function applyDocumentTitle(nextTitle) {
  if (typeof document === 'undefined') return;
  const title = String(nextTitle || '').trim();
  document.title = title || DEFAULT_APP_TITLE;
}

function ensureFaviconLink() {
  if (typeof document === 'undefined') return null;
  const existing =
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]') ||
    document.querySelector('link[rel="apple-touch-icon"]');
  if (existing) return existing;
  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
}

export function applyFaviconUrl(nextUrl) {
  if (typeof document === 'undefined') return;
  const link = ensureFaviconLink();
  if (!link) return;
  const raw = String(nextUrl || '').trim();
  link.href = raw ? resolvePublicMediaUrl(raw) : '/favicon.svg';
}

export function applyBranding({ appTitle, faviconUrl } = {}) {
  applyDocumentTitle(appTitle);
  applyFaviconUrl(faviconUrl);
}
