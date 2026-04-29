import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useIdentitiesStore = create((set, get) => ({
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchIdentities: async ({ q, certificateId, nfcUid, epc, active, limit, offset } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/identities', {
        params: {
          q: q || undefined,
          certificateId: certificateId || undefined,
          nfcUid: nfcUid || undefined,
          epc: epc || undefined,
          active: active == null ? undefined : Boolean(active),
          limit: limit ?? get().limit,
          offset: offset ?? get().offset
        }
      });
      const data = res?.data?.data || {};
      set({
        items: Array.isArray(data.items) ? data.items : [],
        total: Number(data.total) || 0,
        limit: Number(data.limit) || (limit ?? get().limit),
        offset: Number(data.offset) || (offset ?? get().offset),
        loading: false,
        lastSyncAt: Date.now()
      });
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load identities';
      set({ loading: false, error: msg });
      return null;
    }
  },

  unassignIdentity: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post(`/identities/${encodeURIComponent(id)}/unassign`);
      set({ loading: false, lastSyncAt: Date.now() });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Unassign failed';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useIdentitiesStore;

