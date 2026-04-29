import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useMediaStore = create((set, get) => ({
  items: [],
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchMedia: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/uploads/media');
      const items = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ items, loading: false, lastSyncAt: Date.now() });
      return items;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load media';
      set({ items: [], loading: false, error: msg });
      return [];
    }
  },

  uploadMedia: async ({ file }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/uploads/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000
      });
      const created = res?.data?.data;
      const items = [created, ...get().items].filter(Boolean);
      set({ items, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Upload failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  deleteMedia: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      await api.delete(`/uploads/media/${encodeURIComponent(id)}`);
      const items = get().items.filter((it) => String(it.id) !== String(id));
      set({ items, loading: false, lastSyncAt: Date.now() });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Delete failed';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useMediaStore;
