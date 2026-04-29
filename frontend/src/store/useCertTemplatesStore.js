import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useCertTemplatesStore = create((set, get) => ({
  templates: [],
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/templates');
      const templates = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ templates, loading: false, lastSyncAt: Date.now() });
      return templates;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load templates';
      set({ templates: [], loading: false, error: msg });
      return [];
    }
  },

  createTemplate: async ({ name, background, layoutJson }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/templates', { name, background, layoutJson });
      const created = res?.data?.data;
      const templates = [created, ...get().templates].filter(Boolean);
      set({ templates, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to create template';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  updateTemplate: async ({ id, patch }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.patch(`/templates/${encodeURIComponent(id)}`, patch);
      const updated = res?.data?.data;
      const templates = get().templates.map((t) => (String(t.id) === String(id) ? updated : t));
      set({ templates, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update template';
      set({ loading: false, error: msg });
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
      const msg = e?.response?.data?.message || e?.message || 'Failed to delete template';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useCertTemplatesStore;
