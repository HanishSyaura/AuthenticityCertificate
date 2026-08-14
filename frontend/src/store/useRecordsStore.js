import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';
import { tRaw } from '../i18n/tRaw';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useRecordsStore = create((set, get) => ({
  products: [],
  categories: [],
  batchesByProductId: {},
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchProducts: async ({ status } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const params = {};
      if (status && String(status).toLowerCase() !== 'all') params.status = String(status).toLowerCase();
      const hasParams = Object.keys(params).length > 0;
      const res = await api.get('/products/', hasParams ? { params } : undefined);
      const products = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ products, loading: false, lastSyncAt: Date.now() });
      return products;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToLoadProducts');
      set({ loading: false, error: msg });
      return [];
    }
  },

  fetchCategories: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/categories/');
      const categories = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ categories, loading: false, lastSyncAt: Date.now() });
      return categories;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToLoadCategories');
      set({ loading: false, error: msg });
      return [];
    }
  },

  createCategory: async ({ name, code, status }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/categories/', { name, code, status });
      const created = res?.data?.data;
      const categories = [created, ...get().categories].filter(Boolean);
      set({ categories, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToCreateCategory');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  updateCategory: async ({ id, patch }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.patch(`/categories/${encodeURIComponent(id)}`, patch);
      const updated = res?.data?.data;
      const categories = get().categories.map((c) => (String(c.id) === String(id) ? updated : c));
      set({ categories, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToUpdateCategory');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  createProduct: async ({ sku, name, product_code, category, status, remark, cmsDesignId, cmsCertificateDesignId, cmsPageId, cmsCertificatePageId, certificateTemplateId }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const body = { sku, name, product_code, category, status, remark };
      // NEW: bundle-level FKs (multiple inner pages inside one bundle)
      if (cmsDesignId !== undefined) body.cmsDesignId = cmsDesignId;
      if (cmsCertificateDesignId !== undefined) body.cmsCertificateDesignId = cmsCertificateDesignId;
      // LEGACY: single-page FKs (deprecated backward compat)
      if (cmsPageId !== undefined) body.cmsPageId = cmsPageId;
      if (cmsCertificatePageId !== undefined) body.cmsCertificatePageId = cmsCertificatePageId;
      if (certificateTemplateId !== undefined) body.certificateTemplateId = certificateTemplateId;
      const res = await api.post('/products/', body);
      const created = res?.data?.data;
      const products = [created, ...get().products].filter(Boolean);
      set({ products, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToCreateProduct');
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
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToLoadBatches');
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
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToCreateBatch');
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
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToGenerateCertificates');
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
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToUpdateProduct');
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
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToDeactivateProduct');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  activateProduct: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post(`/products/${encodeURIComponent(id)}/activate`);
      const updated = res?.data?.data;
      const products = get().products.map((p) => (String(p.id) === String(id) ? updated : p));
      set({ products, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToActivateProduct');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  deleteProduct: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      await api.delete(`/products/${encodeURIComponent(id)}`);
      const products = get().products.filter((p) => String(p.id) !== String(id));
      set({ products, loading: false, lastSyncAt: Date.now() });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToDeleteProduct');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  bulkDeleteProducts: async ({ ids }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const normalizedIds = Array.from(
        new Set((Array.isArray(ids) ? ids : []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))
      );
      const res = await api.post('/products/bulk-delete', { ids: normalizedIds });
      const result = res?.data?.data || { deletedIds: [], notFoundIds: [], notInactiveIds: [] };
      const deletedIds = Array.isArray(result.deletedIds) ? result.deletedIds : [];
      const deletedIdSet = new Set(deletedIds.map((v) => String(v)));
      const products = get().products.filter((p) => !deletedIdSet.has(String(p.id)));
      set({ products, loading: false, lastSyncAt: Date.now() });
      return result;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToDeleteProducts');
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useRecordsStore;
