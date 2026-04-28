import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function makeMockOverview() {
  return {
    totalScans: 1248,
    last24h: 186,
    uniqueCertificates24h: 92,
    suspicious24h: 11,
    topIps: [
      { ip: '103.12.88.21', count: 38 },
      { ip: '175.143.55.10', count: 31 },
      { ip: '115.164.9.77', count: 26 }
    ],
    topCertificates: [
      { certificateId: 'BN-TEST-123', count: 22 },
      { certificateId: 'BN-A1B2C3D4E5', count: 19 },
      { certificateId: 'BN-9988776655', count: 14 }
    ]
  };
}

function makeMockScans() {
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < 50; i++) {
    const ts = now - i * 60 * 1000;
    rows.push({
      id: `mock-${i}`,
      certificateId: i % 7 === 0 ? 'BN-TEST-123' : `BN-${Math.random().toString(16).slice(2, 12).toUpperCase()}`,
      ip: i % 4 === 0 ? '103.12.88.21' : `175.143.${50 + (i % 20)}.${10 + (i % 200)}`,
      userAgent: 'Mozilla/5.0',
      timestamp: ts,
      iso: new Date(ts).toISOString(),
      riskScore: i % 11 === 0 ? 72 : 18,
      riskFlags: i % 11 === 0 ? ['high_frequency_10m'] : [],
      suspicious: i % 11 === 0
    });
  }
  return { total: rows.length, items: rows };
}

const useAnalyticsStore = create((set, get) => ({
  overview: null,
  scans: { total: 0, items: [] },
  loading: false,
  error: null,
  selectedCertificate: null,
  certificateTimeline: null,

  fetchOverview: async () => {
    const { token } = useAdminAuthStore.getState();
    set({ loading: true, error: null });
    try {
      const api = createAdminApi({ token });
      const res = await api.get('/analytics/overview');
      set({ overview: res?.data?.data || null, loading: false });
    } catch {
      set({ overview: makeMockOverview(), loading: false, error: 'Backend unavailable. Showing demo analytics.' });
    }
  },

  fetchScans: async ({ limit = 200, offset = 0 } = {}) => {
    const { token } = useAdminAuthStore.getState();
    set({ loading: true, error: null });
    try {
      const api = createAdminApi({ token });
      const res = await api.get('/analytics/scans', { params: { limit, offset } });
      set({ scans: res?.data?.data || { total: 0, items: [] }, loading: false });
    } catch {
      set({ scans: makeMockScans(), loading: false, error: 'Backend unavailable. Showing demo scans.' });
    }
  },

  fetchCertificate: async (certificateId) => {
    const { token } = useAdminAuthStore.getState();
    set({ loading: true, error: null, selectedCertificate: certificateId });
    try {
      const api = createAdminApi({ token });
      const res = await api.get(`/analytics/cert/${encodeURIComponent(certificateId)}`);
      set({ certificateTimeline: res?.data?.data || null, loading: false });
    } catch {
      set({ certificateTimeline: null, loading: false, error: 'Backend unavailable.' });
    }
  },

  setOverrideStatus: async ({ certificateId, status }) => {
    const { token } = useAdminAuthStore.getState();
    try {
      const api = createAdminApi({ token });
      await api.post(`/analytics/cert/${encodeURIComponent(certificateId)}/status`, { status });
      await get().fetchCertificate(certificateId);
    } catch (e) {
      void e;
    }
  }
}));

export default useAnalyticsStore;
