import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

const useAnalyticsStore = create((set, get) => ({
  overview: null,
  scans: { total: 0, items: [] },
  loading: false,
  error: null,
  selectedCertificate: null,
  certificateTimeline: null,

  fetchOverview: async () => {
    const { token, orgCode } = useAdminAuthStore.getState();
    set({ loading: true, error: null });
    try {
      const api = createAdminApi({ token, orgCode });
      const res = await api.get('/analytics/overview');
      set({ overview: res?.data?.data || null, loading: false });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load analytics overview';
      set({ overview: null, loading: false, error: msg });
    }
  },

  fetchScans: async ({ limit = 200, offset = 0 } = {}) => {
    const { token, orgCode } = useAdminAuthStore.getState();
    set({ loading: true, error: null });
    try {
      const api = createAdminApi({ token, orgCode });
      const res = await api.get('/analytics/scans', { params: { limit, offset } });
      set({ scans: res?.data?.data || { total: 0, items: [] }, loading: false });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load scans';
      set({ scans: { total: 0, items: [] }, loading: false, error: msg });
    }
  },

  fetchCertificate: async (certificateId) => {
    const { token, orgCode } = useAdminAuthStore.getState();
    set({ loading: true, error: null, selectedCertificate: certificateId });
    try {
      const api = createAdminApi({ token, orgCode });
      const res = await api.get(`/analytics/cert/${encodeURIComponent(certificateId)}`);
      set({ certificateTimeline: res?.data?.data || null, loading: false });
    } catch {
      set({ certificateTimeline: null, loading: false, error: 'Backend unavailable.' });
    }
  },

  setOverrideStatus: async ({ certificateId, status }) => {
    const { token, orgCode } = useAdminAuthStore.getState();
    try {
      const api = createAdminApi({ token, orgCode });
      await api.post(`/analytics/cert/${encodeURIComponent(certificateId)}/status`, { status });
      await get().fetchCertificate(certificateId);
    } catch (e) {
      void e;
    }
  }
}));

export default useAnalyticsStore;
