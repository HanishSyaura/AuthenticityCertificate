import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';
import { tRaw } from '../i18n/tRaw';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useCertTemplatesStore = create((set, get) => ({
  templates: [],
  loading: false,
  error: null,
  lastSyncAt: null,
  saveSeqById: {},
  savingById: {},

  fetchTemplates: async (opts = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const lang = opts?.lang ? String(opts.lang) : null;
      const res = await api.get('/templates', { params: lang ? { lang } : undefined });
      const templates = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ templates, loading: false, lastSyncAt: Date.now() });
      return templates;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ templates: [], loading: false, error: msg });
      return [];
    }
  },

  fetchTemplate: async ({ id, lang } = {}) => {
    if (!id) return null;
    set({ error: null });
    try {
      const api = getApi();
      const l = lang ? String(lang) : null;
      const res = await api.get(`/templates/${encodeURIComponent(id)}`, { params: l ? { lang: l } : undefined });
      const tpl = res?.data?.data || null;
      if (!tpl) return null;
      const templates = get().templates.map((t) => (String(t.id) === String(id) ? tpl : t));
      set({ templates, lastSyncAt: Date.now() });
      return tpl;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ error: msg });
      throw e;
    }
  },

  createTemplate: async ({ certificateId, templateType, name, background, backgroundColor, layoutJson, placeholders, canvasWidth, canvasHeight }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/templates', {
        certificateId,
        templateType,
        name,
        background,
        backgroundColor,
        layoutJson,
        placeholders,
        canvasWidth,
        canvasHeight
      });
      const created = res?.data?.data;
      const templates = [created, ...get().templates].filter(Boolean);
      set({ templates, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  updateTemplate: async ({ id, patch, lang } = {}) => {
    const key = String(id);
    const seq = (get().saveSeqById?.[key] || 0) + 1;
    set((s) => ({
      error: null,
      saveSeqById: { ...(s.saveSeqById || {}), [key]: seq },
      savingById: { ...(s.savingById || {}), [key]: true }
    }));
    try {
      const api = getApi();
      const l = lang ? String(lang) : null;
      const res = await api.patch(`/templates/${encodeURIComponent(id)}`, patch, { params: l ? { lang: l } : undefined });
      const updated = res?.data?.data;
      const isLatest = (get().saveSeqById?.[key] || 0) === seq;
      if (isLatest) {
        const templates = get().templates.map((t) => (String(t.id) === String(id) ? updated : t));
        set((s) => ({
          templates,
          lastSyncAt: Date.now(),
          savingById: { ...(s.savingById || {}), [key]: false }
        }));
        return updated;
      }
      return null;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      const isLatest = (get().saveSeqById?.[key] || 0) === seq;
      set((s) => ({
        error: msg,
        savingById: { ...(s.savingById || {}), [key]: isLatest ? false : s.savingById?.[key] }
      }));
      throw e;
    }
  },

  fillEmptyFromEn: async ({ id, lang } = {}) => {
    if (!id) return null;
    const l = lang ? String(lang) : null;
    if (!l || l === 'en') return null;
    set({ error: null });
    try {
      const api = getApi();
      const res = await api.post(`/templates/${encodeURIComponent(id)}/fill-empty`, null, { params: { lang: l } });
      const updated = res?.data?.data || null;
      if (!updated) return null;
      const templates = get().templates.map((t) => (String(t.id) === String(id) ? updated : t));
      set({ templates, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ error: msg });
      throw e;
    }
  },

  deleteTemplate: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      await api.delete(`/templates/${encodeURIComponent(id)}`);
      const templates = get().templates.filter((t) => String(t.id) !== String(id));
      set({ templates, loading: false, lastSyncAt: Date.now() });
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useCertTemplatesStore;
