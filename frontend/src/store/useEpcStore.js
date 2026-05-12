import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';
import { tRaw } from '../i18n/tRaw';

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

function downloadArrayBufferResponse(res, fallbackFilename) {
  const contentType = res?.headers?.['content-type'] || 'application/octet-stream';
  const disposition = res?.headers?.['content-disposition'] || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || fallbackFilename || 'export.xlsx';
  const blob = new Blob([res.data], { type: contentType });
  downloadBlob(blob, filename);
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

  fetchNextCertificateId: async () => {
    try {
      const api = getApi();
      const res = await api.get('/epc/certificate-id/next');
      return String(res?.data?.data?.certificateId || '').trim();
    } catch (e) {
      return '';
    }
  },

  fetchPeekCertificateId: async () => {
    try {
      const api = getApi();
      const res = await api.get('/epc/certificate-id/peek');
      return String(res?.data?.data?.certificateId || '').trim();
    } catch (e) {
      return '';
    }
  },

  fetchCorpCodes: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/epc/corp-codes');
      const corpCodes = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ corpCodes, loading: false });
      return corpCodes;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return [];
    }
  },

  fetchBatches: async ({ q, origin, limit = 50, offset = 0 } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/epc/batches', { params: { q: q || undefined, origin: origin || undefined, limit, offset } });
      const data = res?.data?.data || {};
      set({
        batches: Array.isArray(data.items) ? data.items : [],
        batchTotal: Number(data.total) || 0,
        loading: false
      });
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return null;
    }
  },

  fetchItems: async ({ q, createdFrom, createdTo, batchId, limit = 50, offset = 0 } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/epc/items', {
        params: {
          q: q || undefined,
          createdFrom: createdFrom || undefined,
          createdTo: createdTo || undefined,
          batchId: batchId != null ? Number(batchId) : undefined,
          limit,
          offset
        }
      });
      const data = res?.data?.data || {};
      set({
        items: Array.isArray(data.items) ? data.items : [],
        itemTotal: Number(data.total) || 0,
        loading: false
      });
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return null;
    }
  },

  generateBatch: async ({ batchQty, remark } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const body = {
        batchQty: Number(batchQty),
        remark: remark || undefined
      };
      const res = await api.post('/epc/batches/generate', body);
      const created = res?.data?.data;
      set({ loading: false, lastGenerated: created });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  exportItemsXlsx: async ({ itemIds, q, createdFrom, createdTo, columns } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const ids = Array.isArray(itemIds) ? itemIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0) : [];
      const cols = Array.isArray(columns) ? columns.map((s) => String(s || '').trim()).filter(Boolean) : [];
      const body = {
        ...(ids.length ? { itemIds: ids } : {}),
        ...(q ? { q: String(q) } : {}),
        ...(createdFrom ? { createdFrom } : {}),
        ...(createdTo ? { createdTo } : {}),
        ...(cols.length ? { columns: cols } : {})
      };
      const res = await api.post('/epc/items/export-xlsx', body, { responseType: 'arraybuffer' });
      downloadArrayBufferResponse(res, 'epc_items.xlsx');
      set({ loading: false });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return false;
    }
  },

  deleteItems: async ({ itemIds, cleanup } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const ids = Array.isArray(itemIds) ? itemIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0) : [];
      const body = { itemIds: ids, ...(cleanup ? { cleanup: true } : {}) };
      const res = await api.post('/epc/items/delete', body);
      set({ loading: false });
      return res?.data?.data || { deletedItems: 0, deletedBatches: 0 };
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return null;
    }
  },

  exportBatchXlsx: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const res = await api.get(`/epc/batches/${id}/export-xlsx`, { responseType: 'arraybuffer' });
      downloadArrayBufferResponse(res, `epc_batch_${id}.xlsx`);
      set({ loading: false });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return false;
    }
  },

  exportBatchXlsxCustom: async ({ batchId, columns }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const cols = Array.isArray(columns) ? columns.map((c) => String(c || '').trim()).filter(Boolean) : [];
      const res = await api.get(`/epc/batches/${id}/export-xlsx`, {
        responseType: 'arraybuffer',
        params: cols.length > 0 ? { columns: cols.join(',') } : undefined
      });
      downloadArrayBufferResponse(res, `epc_batch_${id}.xlsx`);
      set({ loading: false });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return false;
    }
  },

  exportBatchVerifyUrlXlsx: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const res = await api.get(`/epc/batches/${id}/export-verify-url-xlsx`, { responseType: 'arraybuffer' });
      downloadArrayBufferResponse(res, `epc_urls_${id}.xlsx`);
      set({ loading: false });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return false;
    }
  },

  exportBatchProductionTemplateXlsx: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const res = await api.get(`/epc/batches/${id}/export-production-template-xlsx`, { responseType: 'arraybuffer' });
      downloadArrayBufferResponse(res, `epc_input_template_${id}.xlsx`);
      set({ loading: false });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return false;
    }
  },

  exportBatchImportTemplateXlsx: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/epc/batch-import/template-xlsx', { responseType: 'arraybuffer' });
      downloadArrayBufferResponse(res, 'batch_import_template.xlsx');
      set({ loading: false });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return false;
    }
  },

  clearLastGenerated: () => set({ lastGenerated: null }),

  importProductionXlsx: async ({ batchId, base64 }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const res = await api.post(`/epc/batches/${id}/production/import-xlsx`, { base64 });
      set({ loading: false });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  previewBatchImportXlsx: async ({ batchId, base64 }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = batchId == null || String(batchId).trim() === '' ? null : Number(batchId);
      const res =
        id != null && Number.isFinite(id)
          ? await api.post(`/epc/batches/${id}/batch-import/preview-xlsx`, { base64 })
          : await api.post('/epc/batch-import/preview-xlsx', { base64 });
      set({ loading: false });
      return res?.data?.data || null;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  submitBatchImport: async ({ batchId, base64, productId, sku, certificateTemplateId, documents }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = batchId == null || String(batchId).trim() === '' ? null : Number(batchId);
      const body = {
        base64,
        productId: Number(productId),
        sku: String(sku || '').trim(),
        documents: documents || {}
      };
      if (certificateTemplateId !== undefined) {
        body.certificateTemplateId = certificateTemplateId == null || String(certificateTemplateId).trim() === '' ? null : Number(certificateTemplateId);
      }
      const res =
        id != null && Number.isFinite(id)
          ? await api.post(`/epc/batches/${id}/batch-import/submit`, body)
          : await api.post('/epc/batch-import/submit', body);
      const data = res?.data?.data || null;
      const updatedBatch = data?.batch || null;
      if (updatedBatch?.id != null) {
        const batches = (get().batches || []).map((b) => (String(b.id) === String(updatedBatch.id) ? updatedBatch : b));
        set({ batches, loading: false });
      } else {
        set({ loading: false });
      }
      return data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  markProductionDone: async ({ batchId }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const res = await api.post(`/epc/batches/${id}/production/done`, {});
      set({ loading: false });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  deleteBatch: async ({ batchId }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      await api.delete(`/epc/batches/${id}`);
      const batches = (get().batches || []).filter((b) => String(b.id) !== String(id));
      set({ loading: false, batches });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return false;
    }
  },

  recalculateSequence: async ({ corpPrefix }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/epc/corp-sequence/recalculate', { corpPrefix });
      set({ loading: false });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return null;
    }
  },

  deleteAllBatches: async ({ corpPrefix }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/epc/batches/delete-all', { corpPrefix: corpPrefix || undefined });
      set({ loading: false, batches: [], batchTotal: 0, items: [], itemTotal: 0, lastGenerated: null });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return null;
    }
  },

  deleteAllGeneratedBatches: async ({ corpPrefix } = {}) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/epc/batches/delete-generated-all', { corpPrefix: corpPrefix || undefined });
      set({ loading: false, batches: [], batchTotal: 0, items: [], itemTotal: 0, lastGenerated: null });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      return null;
    }
  },

  updateBatch: async ({ batchId, patch }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const id = Number(batchId);
      const res = await api.patch(`/epc/batches/${id}`, patch || {});
      const updated = res?.data?.data;
      const batches = (get().batches || []).map((b) => (String(b.id) === String(id) ? updated : b));
      set({ loading: false, batches });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  importExistingXlsx: async ({ productId, batchName, base64 }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const body = {
        productId: Number(productId),
        batchName: batchName || undefined,
        base64
      };
      const res = await api.post('/epc/import-existing-xlsx', body);
      set({ loading: false });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || tRaw('operationFailed');
      set({ loading: false, error: msg });
      throw e;
    }
  },

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
