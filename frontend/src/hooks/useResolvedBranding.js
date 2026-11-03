import { useEffect, useMemo, useState } from 'react';
import useAdminAuthStore from '../store/useAdminAuthStore';
import useAdminSettingsStore from '../store/useAdminSettingsStore';
import { getPublicApiBaseUrl } from '../utils/apiBase';
import { DEFAULT_APP_TITLE, sanitizeBrandingText } from '../utils/branding';
import { DEFAULT_THEME_PRIMARY_HEX, normalizeHexColor } from '../utils/theme';

const CACHE_KEY = 'ac_public_brand_v2';

function readCachedBranding() {
  if (typeof window === 'undefined') return {};

  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    if (!cached || Date.now() - Number(cached.ts || 0) > 24 * 60 * 60 * 1000) {
      return {};
    }
    return cached;
  } catch {
    return {};
  }
}

function cleanText(value) {
  return sanitizeBrandingText(value) || '';
}

function resolveValues(settings = {}, organization = {}, cached = {}) {
  const highlights = settings.loginHeroHighlights;

  return {
    ...settings,
    organizationName:
      cleanText(organization.name) ||
      cleanText(settings.organizationName) ||
      cleanText(settings.appTitle) ||
      DEFAULT_APP_TITLE,
    organizationCode:
      cleanText(organization.code) ||
      cleanText(settings.organizationCode) ||
      'CLB',
    logoUrl:
      settings.logoUrl ||
      settings.organizationLogoUrl ||
      organization.logoUrl ||
      organization.logo ||
      '',
    appTitle: cleanText(settings.appTitle) || cached.appTitle || DEFAULT_APP_TITLE,
    faviconUrl: settings.faviconUrl || cached.faviconUrl || '',
    themePrimaryHex: normalizeHexColor(
      settings.themePrimaryHex || cached.themePrimaryHex || DEFAULT_THEME_PRIMARY_HEX
    ),
    loginHeroBadge: cleanText(settings.loginHeroBadge),
    loginHeroTitle: cleanText(settings.loginHeroTitle),
    loginHeroSubtitle: cleanText(settings.loginHeroSubtitle),
    loginHeroHighlights: Array.isArray(highlights)
      ? highlights.filter((item) => typeof item === 'string' && item.trim())
      : typeof highlights === 'string'
        ? highlights.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
        : []
  };
}

export default function useResolvedBranding() {
  const token = useAdminAuthStore((state) => state.token);
  const settings = useAdminSettingsStore((state) => state.settings);
  const organization = useAdminSettingsStore((state) => state.organization);
  const [publicData, setPublicData] = useState(readCachedBranding);

  useEffect(() => {
    if (token) return undefined;

    const controller = new AbortController();
    let active = true;

    async function loadPublicBranding() {
      try {
        const base = getPublicApiBaseUrl();
        const response = await fetch(`${base}/settings/`, {
          signal: controller.signal
        });
        if (!response.ok) return;

        const json = await response.json();
        if (!json?.success || !active) return;

        const nextSettings = json?.data?.settings || {};
        const nextOrganization = json?.data?.organization || {};
        const resolved = resolveValues(nextSettings, nextOrganization, publicData);

        setPublicData((previous) => ({
          ...previous,
          ...resolved,
          ts: Date.now()
        }));

        try {
          window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              appTitle: resolved.appTitle,
              faviconUrl: resolved.faviconUrl,
              themePrimaryHex: resolved.themePrimaryHex,
              ts: Date.now()
            })
          );
        } catch {
          // Storage may be unavailable in private browsing.
        }
      } catch {
        // Retain cached/default branding when the public endpoint is unavailable.
      }
    }

    loadPublicBranding();

    return () => {
      active = false;
      controller.abort();
    };
  }, [token]);

  return useMemo(
    () => resolveValues(
      token ? (settings || {}) : publicData,
      token ? (organization || {}) : (publicData.organization || {}),
      publicData
    ),
    [token, settings, organization, publicData]
  );
}
