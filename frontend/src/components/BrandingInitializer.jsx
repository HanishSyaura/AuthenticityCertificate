import React, { useEffect, useRef } from 'react';
import useAdminAuthStore from '../store/useAdminAuthStore';
import useAdminSettingsStore from '../store/useAdminSettingsStore';
import { getPublicApiBaseUrl } from '../utils/apiBase';
import { applyBranding, DEFAULT_APP_TITLE } from '../utils/branding';

const CACHE_KEY = 'ac_public_brand_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const ts = Number(parsed?.ts || 0);
    if (!Number.isFinite(ts) || Date.now() - ts > CACHE_TTL_MS) return null;
    return {
      appTitle: typeof parsed?.appTitle === 'string' ? parsed.appTitle : null,
      faviconUrl: typeof parsed?.faviconUrl === 'string' ? parsed.faviconUrl : null
    };
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...value, ts: Date.now() }));
  } catch {
    void 0;
  }
}

(function applyImmediateBootBranding() {
  if (typeof document === 'undefined') return;
  const cached = readCache();
  applyBranding({
    appTitle: cached?.appTitle || DEFAULT_APP_TITLE,
    faviconUrl: cached?.faviconUrl || null
  });
})();

export default function BrandingInitializer() {
  const token = useAdminAuthStore((s) => s.token);
  const adminSettings = useAdminSettingsStore((s) => s.settings);
  const fetchAdminSettings = useAdminSettingsStore((s) => s.fetchSettings);
  const appliedAdminRef = useRef(false);
  const fetchedPublicRef = useRef(false);

  useEffect(() => {
    applyBranding({ appTitle: DEFAULT_APP_TITLE, faviconUrl: null });
    const cached = readCache();
    if (cached) applyBranding(cached);
  }, []);

  useEffect(() => {
    if (token && typeof fetchAdminSettings === 'function' && !useAdminSettingsStore.getState?.()?.loadedAt) {
      try {
        fetchAdminSettings();
      } catch {
        void 0;
      }
    }
  }, [token, fetchAdminSettings]);

  useEffect(() => {
    const appTitle = adminSettings?.appTitle || null;
    const faviconUrl = adminSettings?.faviconUrl || null;
    if (!appTitle && !faviconUrl) {
      if (token) return;
    }
    if (token) {
      applyBranding({ appTitle, faviconUrl });
      writeCache({
        appTitle: appTitle || readCache()?.appTitle || null,
        faviconUrl: faviconUrl || readCache()?.faviconUrl || null
      });
      appliedAdminRef.current = true;
    }
  }, [adminSettings?.appTitle, adminSettings?.faviconUrl, token]);

  useEffect(() => {
    if (token) return;
    appliedAdminRef.current = false;
    fetchedPublicRef.current = false;
    const cached = readCache();
    if (cached) applyBranding(cached);

    let alive = true;
    const run = async () => {
      if (fetchedPublicRef.current) return;
      fetchedPublicRef.current = true;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const base = getPublicApiBaseUrl();
        const res = await fetch(`${base}/settings/`, { signal: controller.signal });
        clearTimeout(timeout);
        const json = await res.json();
        const next = json?.success ? json?.data?.settings || null : null;
        const appTitle = next?.appTitle ? String(next.appTitle).trim() : null;
        const faviconUrl = next?.faviconUrl ? String(next.faviconUrl).trim() : null;
        if (!alive) return;
        applyBranding({ appTitle, faviconUrl });
        writeCache({
          appTitle: appTitle || cached?.appTitle || null,
          faviconUrl: faviconUrl || cached?.faviconUrl || null
        });
      } catch {
        void 0;
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [token]);

  return null;
}

