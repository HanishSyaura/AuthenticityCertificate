import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token, orgCode } = useAdminAuthStore.getState();
  return createAdminApi({ token, orgCode });
}

const useRecordsStore = create((set, get) => ({
  products: [],
  batchesByProductId: {},
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/products');
      const products = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ products, loading: false, lastSyncAt: Date.now() });
      return products;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load products';
      set({ loading: false, error: msg });
      return [];
    }
  },

  createProduct: async ({ name, code, origin, description }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/products', { name, code, origin, description });
      const created = res?.data?.data;
      const products = [created, ...get().products].filter(Boolean);
      set({ products, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to create product';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  fetchBatches: async (productId) => {
    if (!productId) return [];
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get(`/products/${encodeURIComponent(productId)}/batches`);
      const batches = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({
        batchesByProductId: { ...get().batchesByProductId, [String(productId)]: batches },
        loading: false,
        lastSyncAt: Date.now()
      });
      return batches;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load batches';
      set({ loading: false, error: msg });
      return [];
    }
  },

  createBatch: async ({ productId, batchNo }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/products/batches', { productId: Number(productId), batchNo });
      const created = res?.data?.data;
      const prev = get().batchesByProductId[String(productId)] || [];
      const next = [created, ...prev].filter(Boolean);
      set({
        batchesByProductId: { ...get().batchesByProductId, [String(productId)]: next },
        loading: false,
        lastSyncAt: Date.now()
      });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to create batch';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  generateCertificates: async ({ batchId, type, quantity }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const body = {
        batchId: Number(batchId),
        type,
        quantity: quantity != null && String(quantity).trim() !== '' ? Number(quantity) : undefined
      };
      const res = await api.post('/certificates/generate', body);
      set({ loading: false, lastSyncAt: Date.now() });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to generate certificates';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  updateProduct: async ({ id, patch }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.patch(`/products/${encodeURIComponent(id)}`, patch);
      const updated = res?.data?.data;
      const products = get().products.map((p) => (String(p.id) === String(id) ? updated : p));
      set({ products, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update product';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  deactivateProduct: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post(`/products/${encodeURIComponent(id)}/deactivate`);
      const updated = res?.data?.data;
      const products = get().products.map((p) => (String(p.id) === String(id) ? updated : p));
      set({ products, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to deactivate product';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useRecordsStore;
