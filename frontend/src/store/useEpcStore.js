import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const useEpcStore = create((set, get) => ({
  corpCodes: [],
  batches: [],
  batchTotal: 0,
  items: [],
  itemTotal: 0,
  loading: false,
  error: null,
  lastGenerated: null,

  fetchCorpCodes: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/epc/corp-codes');
      const corpCodes = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ corpCodes, loading: false });
      return corpCodes;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load corp codes';
      set({ loading: false, error: msg });
      return [];
    }
  },

  fetchBatches: async ({ q, limit = 50, offset = 0 } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/epc/batches', { params: { q: q || undefined, limit, offset } });
      const data = res?.data?.data || {};
      set({
        batches: Array.isArray(data.items) ? data.items : [],
        batchTotal: Number(data.total) || 0,
        loading: false
      });
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load EPC batches';
      set({ loading: false, error: msg });
      return null;
    }
  },

  fetchItems: async ({ q, batchId, limit = 50, offset = 0 } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/epc/items', {
        params: { q: q || undefined, batchId: batchId != null ? Number(batchId) : undefined, limit, offset }
      });
      const data = res?.data?.data || {};
      set({
        items: Array.isArray(data.items) ? data.items : [],
        itemTotal: Number(data.total) || 0,
        loading: false
      });
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load EPC items';
      set({ loading: false, error: msg });
      return null;
    }
  },

  generateBatch: async ({ corpPrefix, productId, batchName, batchQty, remark }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const body = {
        corpPrefix,
        productId: Number(productId),
        batchName,
        batchQty: Number(batchQty),
        remark: remark || undefined
      };
      const res = await api.post('/epc/batches/generate', body);
      const created = res?.data?.data;
      set({ loading: false, lastGenerated: created });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Generate EPC failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  exportBatchXlsx: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const res = await api.get(`/epc/batches/${id}/export-xlsx`, { responseType: 'arraybuffer' });
      const contentType = res?.headers?.['content-type'] || 'application/octet-stream';
      const disposition = res?.headers?.['content-disposition'] || '';
      const match = /filename="([^"]+)"/i.exec(disposition);
      const filename = match?.[1] || `epc_batch_${id}.xlsx`;
      const blob = new Blob([res.data], { type: contentType });
      downloadBlob(blob, filename);
      set({ loading: false });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Export failed';
      set({ loading: false, error: msg });
      return false;
    }
  },

  clearLastGenerated: () => set({ lastGenerated: null }),

  selectBatch: async (batchId) => {
    set({ loading: true, error: null });
    try {
      await get().fetchItems({ batchId, limit: 50, offset: 0 });
      set({ loading: false });
    } catch {
      set({ loading: false });
    }
  }
}));

export default useEpcStore;
