import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function safeSlugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const useCmsStore = create((set, get) => ({
  pages: [],
  layoutsByPageKey: {},
  selectedPageId: null,
  loading: false,
  error: null,

  selectPage: (pageId) => set({ selectedPageId: pageId }),

  fetchPages: async () => {
    const { token } = useAdminAuthStore.getState();
    set({ loading: true, error: null });

    if (!token) {
      set({ pages: [], loading: false, error: 'Not authenticated' });
      return;
    }

    try {
      const api = createAdminApi({ token });
      const res = await api.get('/cms/pages');
      const pages = res?.data?.data || [];
      set({ pages, loading: false });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load pages';
      set({ pages: [], loading: false, error: msg });
    }
  },

  createPage: async ({ name, slug }) => {
    const { token } = useAdminAuthStore.getState();
    const safeSlug = safeSlugify(slug || name);
    const pages = get().pages;

    if (!token) throw new Error('Not authenticated');

    try {
      const api = createAdminApi({ token });
      const res = await api.post('/cms/page', { name, slug: safeSlug });
      const created = res?.data?.data;
      const updated = [created, ...pages];
      set({ pages: updated });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to create page';
      throw new Error(msg);
    }
  },

  loadLayoutForPage: async ({ page }) => {
    if (!page?.id) return;

    const language = get().language || 'en';
    const key = `${page.id}:${language}`;

    const current = get().layoutsByPageKey || {};
    const existing = current[key] || current[String(page.id)];
    if (existing) return;

    try {
      const api = createAdminApi({ token: null });
      const res = await api.get(`/cms/page/${encodeURIComponent(page.slug)}`, { params: { language } });
      const dbLayout = res?.data?.data?.effectiveLayout || res?.data?.data?.layout?.layoutJson;
      if (Array.isArray(dbLayout)) {
        const next = { ...current, [key]: dbLayout };
        set({ layoutsByPageKey: next });
        return;
      }
    } catch (e) {
      void e;
    }
  },

  language: 'en',
  setLanguage: (language) => set({ language }),

  saveLayout: async ({ pageId, layoutJson, language }) => {
    const lang = language || get().language || 'en';
    const { token } = useAdminAuthStore.getState();
    const nextLayouts = { ...(get().layoutsByPageKey || {}), [`${pageId}:${lang}`]: layoutJson };
    set({ layoutsByPageKey: nextLayouts });

    if (!token) throw new Error('Not authenticated');

    try {
      const api = createAdminApi({ token });
      await api.post('/cms/layout', { pageId, layoutJson, language: lang });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to save layout';
      throw new Error(msg);
    }
  },

  publishPage: async ({ pageId }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error('Not authenticated');
    const api = createAdminApi({ token });
    const res = await api.post('/cms/publish', { pageId });
    return res?.data?.data;
  }
}));

export default useCmsStore;
