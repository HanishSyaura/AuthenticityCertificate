import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { ADMIN_KEYS } from '../utils/adminKeys';
import { readJson, writeJson } from '../utils/storage';
import { createAdminApi } from '../utils/adminApi';

function getLocalPages() {
  return readJson(ADMIN_KEYS.cmsPages, []);
}

function getLocalLayouts() {
  return readJson(ADMIN_KEYS.cmsLayouts, {});
}

function writeLocalPages(pages) {
  writeJson(ADMIN_KEYS.cmsPages, pages);
}

function writeLocalLayouts(layouts) {
  writeJson(ADMIN_KEYS.cmsLayouts, layouts);
}

function safeSlugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const useCmsStore = create((set, get) => ({
  pages: getLocalPages(),
  layoutsByPageKey: getLocalLayouts(),
  selectedPageId: null,
  loading: false,
  error: null,

  selectPage: (pageId) => set({ selectedPageId: pageId }),

  fetchPages: async () => {
    const { mode, token } = useAdminAuthStore.getState();
    set({ loading: true, error: null });

    if (mode === 'mock' || !token) {
      const pages = getLocalPages();
      set({ pages, loading: false });
      return;
    }

    try {
      const api = createAdminApi({ token });
      const res = await api.get('/cms/pages');
      const pages = res?.data?.data || [];
      writeLocalPages(pages);
      set({ pages, loading: false });
    } catch (e) {
      const pages = getLocalPages();
      set({ pages, loading: false, error: 'Backend unavailable. Using mock CMS storage.' });
      useAdminAuthStore.getState().setMode('mock');
    }
  },

  createPage: async ({ name, slug }) => {
    const { mode, token } = useAdminAuthStore.getState();
    const safeSlug = safeSlugify(slug || name);
    const pages = get().pages;

    if (mode === 'mock' || !token) {
      const next = {
        id: Date.now(),
        name,
        slug: safeSlug
      };
      const updated = [next, ...pages];
      writeLocalPages(updated);
      set({ pages: updated });
      return next;
    }

    try {
      const api = createAdminApi({ token });
      const res = await api.post('/cms/page', { name, slug: safeSlug });
      const created = res?.data?.data;
      const updated = [created, ...pages];
      writeLocalPages(updated);
      set({ pages: updated });
      return created;
    } catch {
      useAdminAuthStore.getState().setMode('mock');
      return get().createPage({ name, slug: safeSlug });
    }
  },

  loadLayoutForPage: async ({ page }) => {
    if (!page?.id) return;

    const language = get().language || 'en';
    const key = `${page.id}:${language}`;

    const localLayouts = getLocalLayouts();
    const existing = localLayouts[key] || localLayouts[String(page.id)];
    if (existing) {
      set({ layoutsByPageKey: localLayouts });
      return;
    }

    const { mode } = useAdminAuthStore.getState();
    if (mode === 'mock') {
      set({ layoutsByPageKey: localLayouts });
      return;
    }

    try {
      const api = createAdminApi({ token: null });
      const res = await api.get(`/cms/page/${encodeURIComponent(page.slug)}`, { params: { language } });
      const dbLayout = res?.data?.data?.effectiveLayout || res?.data?.data?.layout?.layoutJson;
      if (Array.isArray(dbLayout)) {
        const next = { ...localLayouts, [key]: dbLayout };
        writeLocalLayouts(next);
        set({ layoutsByPageKey: next });
        return;
      }
      set({ layoutsByPageKey: localLayouts });
    } catch {
      set({ layoutsByPageKey: localLayouts });
    }
  },

  language: 'en',
  setLanguage: (language) => set({ language }),

  saveLayout: async ({ pageId, layoutJson, language }) => {
    const lang = language || get().language || 'en';
    const { mode, token } = useAdminAuthStore.getState();
    const localLayouts = getLocalLayouts();
    const nextLayouts = { ...localLayouts, [`${pageId}:${lang}`]: layoutJson };
    writeLocalLayouts(nextLayouts);
    set({ layoutsByPageKey: nextLayouts });

    if (mode === 'mock' || !token) return;

    try {
      const api = createAdminApi({ token });
      await api.post('/cms/layout', { pageId, layoutJson, language: lang });
    } catch {
      useAdminAuthStore.getState().setMode('mock');
    }
  },

  publishPage: async ({ pageId }) => {
    const { mode, token } = useAdminAuthStore.getState();
    if (mode === 'mock' || !token) {
      return { pageId, published: true };
    }
    const api = createAdminApi({ token });
    const res = await api.post('/cms/publish', { pageId });
    return res?.data?.data;
  }
}));

export default useCmsStore;
