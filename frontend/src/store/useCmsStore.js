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

function sanitizeDesignsList(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .filter((d) => d && typeof d === 'object')
    .filter((d) => d.id != null && String(d.id).trim())
    .map((d) => ({
      ...d,
      id: d.id,
      name: String(d.name || '').trim() || `Design ${String(d.id)}`,
      slug: String(d.slug || '').trim(),
      kind: String(d.kind || 'landing').trim() || 'landing',
      description: d.description == null ? null : String(d.description).trim() || null,
      published: !!d.publishedVersionId,
    }))
    .filter((d) => d.slug)
    .sort((a, b) => Number(a.id) - Number(b.id));
}

const useCmsStore = create((set, get) => ({
  // =============================================================
  // STATE: CmsDesign (top-level landing page bundles / designs)
  // selectedDesignId = null means: use "Default (legacy)" group (pages with designId IS NULL)
  // =============================================================
  designs: [],
  selectedDesignId: null,
  loadingDesigns: false,

  setSelectedDesignId: (id) => {
    const target = id === null || id === '' || id === 'null' ? null : Number(id);
    set({ selectedDesignId: target, layoutsByPageKey: {}, selectedPageId: null });
  },

  fetchDesigns: async ({ kind } = {}) => {
    const { token } = useAdminAuthStore.getState();
    set({ loadingDesigns: true, error: null });
    if (!token) {
      set({ designs: [], loadingDesigns: false, error: tRaw('notAuthenticated') });
      return [];
    }
    try {
      const api = createAdminApi({ token });
      const params = {};
      if (typeof kind === 'string' && kind) params.kind = kind;
      const hasParams = Object.keys(params).length > 0;
      const res = await api.get('/cms/designs', hasParams ? { params } : undefined);
      const designs = sanitizeDesignsList(res?.data?.data || []);
      set({ designs, loadingDesigns: false });
      return designs;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ designs: [], loadingDesigns: false, error: msg });
      return [];
    }
  },

  createDesign: async ({ name, slug, kind, description }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));
    const safeSlug = safeSlugify(slug || name);
    const k = typeof kind === 'string' && kind ? kind : 'landing';
    try {
      const api = createAdminApi({ token });
      const res = await api.post('/cms/design', { name, slug: safeSlug, kind: k, description });
      const created = res?.data?.data;
      const designs = sanitizeDesignsList([...(get().designs || []), created].filter(Boolean));
      set({ designs, selectedDesignId: created?.id ?? null });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      throw new Error(msg);
    }
  },

  patchDesign: async ({ id, name, slug, kind, description }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));
    const body = {};
    if (name !== undefined) body.name = name;
    if (slug !== undefined) body.slug = safeSlugify(slug);
    if (kind !== undefined) body.kind = kind;
    if (description !== undefined) body.description = description;
    try {
      const api = createAdminApi({ token });
      const res = await api.patch(`/cms/design/${encodeURIComponent(id)}`, body);
      const updated = res?.data?.data;
      const designs = sanitizeDesignsList(
        (get().designs || []).map((d) => String(d.id) === String(id) && updated ? { ...d, ...updated } : d)
      );
      set({ designs });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      throw new Error(msg);
    }
  },

  deleteDesign: async ({ id }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));
    try {
      const api = createAdminApi({ token });
      await api.delete(`/cms/design/${encodeURIComponent(id)}`);
      const designs = sanitizeDesignsList((get().designs || []).filter((d) => String(d.id) !== String(id)));
      const wasSelected = String(get().selectedDesignId) === String(id);
      set({
        designs,
        ...(wasSelected ? { selectedDesignId: null, pages: [], layoutsByPageKey: {}, selectedPageId: null } : {}),
      });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      throw new Error(msg);
    }
  },

  materializeDefaultDesign: async ({ name, slug, kind, description }) => {
    const { token } = useAdminAuthStore.getState();
    if (!token) throw new Error(tRaw('notAuthenticated'));
    const k = typeof kind === 'string' && kind ? kind : 'landing';
    const safeSlug = slug ? safeSlugify(slug) : undefined;
    try {
      const api = createAdminApi({ token });
      const res = await api.post('/cms/design/default-rename', { name, slug: safeSlug, kind: k, description });
      const row = res?.data?.data;
      const existing = get().designs || [];
      const exists = existing.some((d) => String(d.id) === String(row?.id));
      const designs = sanitizeDesignsList(exists
        ? existing.map((d) => String(d.id) === String(row?.id) && row ? { ...d, ...row } : d)
        : [...existing, row].filter(Boolean));
      set({ designs, selectedDesignId: row?.id ?? get().selectedDesignId ?? null });
      return row;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      throw new Error(msg);
    }
  },

  // =============================================================
  // STATE: CmsPage (inner pages / sections WITHIN currently-selected design)
  // =============================================================
  pages: [],
  layoutsByPageKey: {},
  selectedPageId: null,
  loading: false,
  error: null,

  selectPage: (pageId) => set({ selectedPageId: pageId }),

  fetchPages: async (opts) => {
    const { token } = useAdminAuthStore.getState();
    set({ loading: true, error: null });
    const kind = opts?.kind != null ? opts.kind : 'landing';
    // Respect explicit opts.designId if provided; otherwise use the currently selected design
    const designId =
      opts && Object.prototype.hasOwnProperty.call(opts, 'designId')
        ? opts.designId
        : get().selectedDesignId; // null = default group, number = specific group, undefined = backend returns all

    if (!token) {
      set({ pages: [], loading: false, error: tRaw('notAuthenticated') });
      return;
    }

    try {
      const api = createAdminApi({ token });
      const params = {};
      if (kind) params.kind = kind;
      if (designId === null) params.designId = 'null'; // IS NULL (legacy default group)
      else if (designId !== undefined) params.designId = Number(designId);
      const hasParams = Object.keys(params).length > 0;
      const res = await api.get('/cms/pages', hasParams ? { params } : undefined);
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
    const designId = get().selectedDesignId; // null => attach to default group; number => attach to that group

    if (!token) throw new Error(tRaw('notAuthenticated'));

    try {
      const api = createAdminApi({ token });
      const payload = { name, slug: safeSlug, kind };
      if (designId === null) payload.designId = null;
      else if (designId != null) payload.designId = Number(designId);
      const res = await api.post('/cms/page', payload);
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
    const existing = current[key];
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
      if (String(lang).toLowerCase() === 'en') {
        set((state) => {
          const byKey = state.layoutsByPageKey || {};
          const keepKey = `${pageId}:en`;
          const prefix = `${pageId}:`;
          const cleaned = {};
          for (const [k, v] of Object.entries(byKey)) {
            if (k === keepKey) {
              cleaned[k] = v;
              continue;
            }
            if (k.startsWith(prefix)) continue;
            cleaned[k] = v;
          }
          return { layoutsByPageKey: cleaned };
        });
      }
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
