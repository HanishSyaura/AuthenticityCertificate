import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function sortPages(list) {
  const pages = Array.isArray(list) ? list : [];
  return [...pages].sort((a, b) => {
    const ao = Number(a?.sortOrder) || 0;
    const bo = Number(b?.sortOrder) || 0;
    if (ao !== bo) return ao - bo;
    return Number(a?.id) - Number(b?.id);
  });
}

function safeSlugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function sanitizeLayoutBlocks(raw, { pageId, language }) {
  const list = Array.isArray(raw) ? raw : [];
  const used = new Set();
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    if (!b || typeof b !== 'object') continue;
    const base = String(b.id || `b-${String(pageId)}-${String(language || 'en')}-${i}`);
    let id = base;
    let n = 1;
    while (used.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    used.add(id);
    out.push({ ...b, id });
  }
  return out;
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
    const kind = 'landing';

    if (!token) {
      set({ pages: [], loading: false, error: 'Not authenticated' });
      return;
    }

    try {
      const api = createAdminApi({ token });
      const res = await api.get('/cms/pages', { params: { kind } });
      const pages = sortPages(res?.data?.data || []);
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
    const kind = 'landing';

    if (!token) throw new Error('Not authenticated');

    try {
      const api = createAdminApi({ token });
      const res = await api.post('/cms/page', { name, slug: safeSlug, kind });
      const created = res?.data?.data;
      const updated = sortPages([...(pages || []), created].filter(Boolean));
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
      const rawLayout = res?.data?.data?.effectiveLayout ?? res?.data?.data?.layout?.layoutJson ?? null;
      let dbLayout = rawLayout;
      if (typeof dbLayout === 'string') {
        try {
          dbLayout = JSON.parse(dbLayout);
        } catch {
          dbLayout = rawLayout;
        }
      }
      if (Array.isArray(dbLayout)) {
        const safe = sanitizeLayoutBlocks(dbLayout, { pageId: page.id, language });
        const next = { ...current, [key]: safe };
        set({ layoutsByPageKey: next, error: null });
        return;
      }
      const next = { ...current, [key]: [] };
      set({ layoutsByPageKey: next, error: 'Failed to load page layout' });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load page layout';
      const next = { ...current, [key]: [] };
      set({ layoutsByPageKey: next, error: msg });
    }
  },

  language: 'en',
  setLanguage: (language) => set({ language }),

  saveLayout: async ({ pageId, layoutJson, language }) => {
    const lang = language || get().language || 'en';
    const { token } = useAdminAuthStore.getState();
    const safe = sanitizeLayoutBlocks(layoutJson, { pageId, language: lang });
    const nextLayouts = { ...(get().layoutsByPageKey || {}), [`${pageId}:${lang}`]: safe };
    set({ layoutsByPageKey: nextLayouts });

    if (!token) throw new Error('Not authenticated');

    try {
      const api = createAdminApi({ token });
      await api.post('/cms/layout', { pageId, layoutJson: safe, language: lang });
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
  },

  deletePage: async ({ pageId }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error('Not authenticated');
    const api = createAdminApi({ token });
    await api.delete(`/cms/page/${encodeURIComponent(pageId)}`);
    const pages = (get().pages || []).filter((p) => String(p.id) !== String(pageId));
    set({ pages: sortPages(pages) });
  },

  reorderPages: async ({ orderedIds }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error('Not authenticated');

    const prevPages = get().pages || [];
    const kind = 'landing';
    const ids = Array.from(new Set((orderedIds || []).map((v) => Number(v)).filter((n) => Number.isFinite(n))));
    if (!ids.length) return;

    const byId = new Map(prevPages.map((p) => [String(p.id), p]));
    const inOrder = ids.map((id) => byId.get(String(id))).filter(Boolean);
    const remaining = prevPages.filter((p) => !ids.some((id) => String(id) === String(p.id)));
    const merged = [...inOrder, ...remaining].map((p, idx) => ({ ...p, sortOrder: idx + 1 }));
    set({ pages: merged, error: null });

    try {
      const api = createAdminApi({ token });
      await api.patch('/cms/pages/order', { orderedIds: merged.map((p) => Number(p.id)), kind });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to reorder pages';
      set({ pages: prevPages, error: msg });
      throw new Error(msg);
    }
  }
}));

export default useCmsStore;
