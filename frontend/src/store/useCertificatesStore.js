import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useCertificatesStore = create((set, get) => ({
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchCertificates: async ({ q, status, type, batchNo, productCode, limit, offset } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/certificates', {
        params: {
          q: q || undefined,
          status: status || undefined,
          type: type || undefined,
          batchNo: batchNo || undefined,
          productCode: productCode || undefined,
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
      const msg = e?.response?.data?.message || e?.message || 'Failed to load certificates';
      set({ loading: false, error: msg });
      return null;
    }
  },

  assignIdentity: async ({ certificateId, nfcUid, epc, expiresAt }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/certificates/assign', {
        certificateId,
        nfcUid: nfcUid || undefined,
        epc: epc || undefined,
        expiresAt: expiresAt || undefined
      });
      set({ loading: false, lastSyncAt: Date.now() });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Assign failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  revokeCertificate: async ({ certificateId }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post(`/certificates/revoke/${encodeURIComponent(certificateId)}`);
      set({ loading: false, lastSyncAt: Date.now() });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Revoke failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  reissueCertificate: async ({ certificateId, reason }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/certificates/reissue', { certificateId, reason: reason || undefined });
      set({ loading: false, lastSyncAt: Date.now() });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Reissue failed';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useCertificatesStore;

