import { resolvePublicMediaUrl } from './apiBase';
import { applyTheme, DEFAULT_THEME_PRIMARY_HEX } from './theme';

export const DEFAULT_APP_TITLE = 'Zora Pro PAC';
export const LEGACY_BRANDING_PLACEHOLDER = 'DAMADINGJIYANWO';
const DEFAULT_FAVICON_HREF = '/favicon.svg';

export function sanitizeBrandingText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.toUpperCase() === LEGACY_BRANDING_PLACEHOLDER) return '';
  return text;
}

export function applyDocumentTitle(nextTitle) {
  if (typeof document === 'undefined') return;
  const title = String(nextTitle || '').trim();
  document.title = title || DEFAULT_APP_TITLE;
}

function guessFaviconMime(href) {
  const s = String(href || '').toLowerCase().split('?')[0];
  if (s.endsWith('.svg')) return 'image/svg+xml';
  if (s.endsWith('.ico')) return 'image/x-icon';
  if (s.endsWith('.png')) return 'image/png';
  if (s.endsWith('.jpg') || s.endsWith('.jpeg')) return 'image/jpeg';
  if (s.endsWith('.gif')) return 'image/gif';
  if (s.endsWith('.webp')) return 'image/webp';
  return '';
}

function removeLinks(selector) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(selector).forEach((el) => el.parentNode?.removeChild(el));
}

function cacheBustedHref(rawHref) {
  const s = String(rawHref || '').trim();
  if (!s) return s;
  if (/^data:/i.test(s)) return s;
  try {
    const u = new URL(s, typeof window !== 'undefined' ? window.location.href : undefined);
    if (!/^https?:/i.test(u.protocol) && !/^blob:/i.test(u.protocol)) return s;
    if (u.host === (typeof window !== 'undefined' ? window.location.host : u.host)) {
      const marker = '__fvv=';
      if (u.search.includes(marker)) return s;
      const sep = u.search ? '&' : '?';
      return `${s}${sep}${marker}${Date.now()}`;
    }
    return s;
  } catch {
    if (/[?&]__fvv=/.test(s)) return s;
    return `${s}${s.includes('?') ? '&' : '?'}__fvv=${Date.now()}`;
  }
}

export function applyFaviconUrl(nextUrl) {
  if (typeof document === 'undefined') return;
  const raw = String(nextUrl || '').trim();
  const removeAllFavicons = () => {
    removeLinks('link[rel="icon"]');
    removeLinks('link[rel="shortcut icon"]');
    removeLinks('link[rel="apple-touch-icon"]');
    removeLinks('link[rel="apple-touch-icon-precomposed"]');
    removeLinks('link[rel="mask-icon"]');
  };
  if (!raw) {
    removeAllFavicons();
    return;
  }
  const resolvedHref = resolvePublicMediaUrl(raw);
  if (!resolvedHref) {
    removeAllFavicons();
    return;
  }
  removeAllFavicons();
  const finalHref = cacheBustedHref(resolvedHref);
  const mime = guessFaviconMime(finalHref);
  const iconRels = ['icon', 'shortcut icon'];

  iconRels.forEach((rel) => {
    const link = document.createElement('link');
    link.rel = rel;
    if (mime) link.type = mime;
    link.href = finalHref;
    link.referrerPolicy = 'no-referrer';
    link.onerror = () => {
      try { link.parentNode?.removeChild(link); } catch {}
    };
    document.head.appendChild(link);
  });

  const appleLink = document.createElement('link');
  appleLink.rel = 'apple-touch-icon';
  appleLink.sizes = '180x180';
  if (mime) appleLink.type = mime;
  appleLink.href = finalHref;
  appleLink.referrerPolicy = 'no-referrer';
  appleLink.onerror = () => {
    try { appleLink.parentNode?.removeChild(appleLink); } catch {}
  };
  document.head.appendChild(appleLink);
}

export function applyBranding({ appTitle, faviconUrl, themePrimaryHex } = {}) {
  applyDocumentTitle(appTitle);
  applyFaviconUrl(faviconUrl);
  applyTheme(themePrimaryHex || DEFAULT_THEME_PRIMARY_HEX);
}
