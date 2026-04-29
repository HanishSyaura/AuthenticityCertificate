import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useFraudStore = create((set, get) => ({
  items: [],
  total: 0,
  limit: 200,
  offset: 0,
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchFlags: async ({ status, limit, offset } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/fraud/flags', {
        params: {
          status: status || 'open',
          limit: limit ?? get().limit,
          offset: offset ?? get().offset
        }
      });
      const data = res?.data?.data || {};
      set({
        items: Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [],
        total: Number(data.total) || 0,
        limit: Number(data.limit) || (limit ?? get().limit),
        offset: Number(data.offset) || (offset ?? get().offset),
        loading: false,
        lastSyncAt: Date.now()
      });
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load fraud flags';
      set({ loading: false, error: msg });
      return null;
    }
  },

  resolveFlag: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.patch(`/fraud/flags/${encodeURIComponent(id)}/resolve`, {});
      set({ loading: false, lastSyncAt: Date.now() });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Resolve failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  createFlag: async ({ certificateId, reason, severity }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/fraud/flags', { certificateId, reason, severity: severity || undefined });
      const created = res?.data?.data;
      const next = [created, ...get().items].filter(Boolean);
      set({ items: next, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Create flag failed';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useFraudStore;

