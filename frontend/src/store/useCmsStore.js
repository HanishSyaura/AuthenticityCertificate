import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';
import { tRaw } from '../i18n/tRaw';

function sortPages(list) {
  const pages = Array.isArray(list) ? list : [];
  return [...pages].sort((a, b) => {
    const ao = Number(a?.sortOrder) || 0;
    const bo = Number(b?.sortOrder) || 0;
    if (ao !== bo) return ao - bo;
    return Number(a?.id) - Number(b?.id);
  });
}

function sanitizePagesList(list) {
  const pages = Array.isArray(list) ? list : [];
  return pages
    .filter((p) => p && typeof p === 'object')
    .filter((p) => p.id != null && String(p.id).trim())
    .map((p) => ({
      ...p,
      id: p.id,
      name: String(p.name || '').trim() || `Page ${String(p.id)}`,
      slug: String(p.slug || '').trim()
    }))
    .filter((p) => p.slug);
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

function coerceLayoutToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.blocks)) return value.blocks;
    if (Array.isArray(value.layoutJson)) return value.layoutJson;
  }
  return null;
}

function pickTextOnlyTranslationLayout(layout) {
  const arr = Array.isArray(layout) ? layout : [];
  const out = [];
  const used = new Set();
  for (const b of arr) {
    if (!b || typeof b !== 'object') continue;
    if (String(b.type || '') !== 'text') continue;
    const id = String(b.id || '').trim();
    if (!id || used.has(id)) continue;
    used.add(id);
    const text = b?.content?.text;
    if (typeof text !== 'string') continue;
    out.push({ id, type: 'text', content: { text } });
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
      set({ pages: [], loading: false, error: tRaw('notAuthenticated') });
      return;
    }

    try {
      const api = createAdminApi({ token });
      const res = await api.get('/cms/pages', { params: { kind } });
      const pages = sortPages(sanitizePagesList(res?.data?.data || []));
      set({ pages, loading: false });
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ pages: [], loading: false, error: msg });
    }
  },

  createPage: async ({ name, slug }) => {
    const { token } = useAdminAuthStore.getState();
    const safeSlug = safeSlugify(slug || name);
    const pages = get().pages;
    const kind = 'landing';

    if (!token) throw new Error(tRaw('notAuthenticated'));

    try {
      const api = createAdminApi({ token });
      const res = await api.post('/cms/page', { name, slug: safeSlug, kind });
      const created = res?.data?.data;
      const updated = sortPages(sanitizePagesList([...(pages || []), created].filter(Boolean)));
      set({ pages: updated });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
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
      const data = res?.data?.data || {};
      const picked =
        coerceLayoutToArray(data?.effectiveLayout) ??
        coerceLayoutToArray(data?.layout?.layoutJson) ??
        [];
      const safe = sanitizeLayoutBlocks(picked, { pageId: page.id, language });
      const next = { ...current, [key]: safe };
      const selectedPageId = get().selectedPageId;
      set({ layoutsByPageKey: next, ...(String(selectedPageId) === String(page.id) ? { error: null } : {}) });
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      const next = { ...current, [key]: [] };
      const selectedPageId = get().selectedPageId;
      set({ layoutsByPageKey: next, ...(String(selectedPageId) === String(page.id) ? { error: msg } : {}) });
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

    if (!token) throw new Error(tRaw('notAuthenticated'));

    try {
      const api = createAdminApi({ token });
      const payload = String(lang).toLowerCase() === 'en' ? safe : pickTextOnlyTranslationLayout(safe);
      await api.post('/cms/layout', { pageId, layoutJson: payload, language: lang });
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      throw new Error(msg);
    }
  },

  fillEmptyFromEn: async ({ pageId, language }) => {
    const lang = String(language || get().language || 'en');
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));
    if (!pageId) return null;
    if (String(lang).toLowerCase() === 'en') return null;
    const api = createAdminApi({ token });
    const res = await api.post('/cms/fill-empty', { pageId: Number(pageId), language: lang });
    return res?.data?.data || null;
  },

  publishPage: async ({ pageId }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));
    const api = createAdminApi({ token });
    const res = await api.post('/cms/publish', { pageId });
    return res?.data?.data;
  },

  deletePage: async ({ pageId }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));
    const api = createAdminApi({ token });
    await api.delete(`/cms/page/${encodeURIComponent(pageId)}`);
    const pages = (get().pages || []).filter((p) => String(p.id) !== String(pageId));
    set({ pages: sortPages(sanitizePagesList(pages)) });
  },

  reorderPages: async ({ orderedIds }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));

    const prevPages = sanitizePagesList(get().pages || []);
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
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ pages: prevPages, error: msg });
      throw new Error(msg);
    }
  }
}));

export default useCmsStore;
