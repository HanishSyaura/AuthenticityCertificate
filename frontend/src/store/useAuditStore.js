import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useAuditStore = create((set) => ({
  audits: { total: 0, items: [] },
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchAudits: async ({ limit = 200, offset = 0 } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/audit', { params: { limit, offset } });
      const audits = res?.data?.data || { total: 0, items: [] };
      set({ audits, loading: false, lastSyncAt: Date.now() });
      return audits;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load audit log';
      set({ loading: false, error: msg });
      return { total: 0, items: [] };
    }
  }
}));

export default useAuditStore;
