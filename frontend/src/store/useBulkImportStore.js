import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf('base64,');
      if (idx === -1) return reject(new Error('Invalid file encoding'));
      resolve(result.slice(idx + 7));
    };
    reader.readAsDataURL(file);
  });
}

const useBulkImportStore = create((set) => ({
  loading: false,
  error: null,
  result: null,

  importWorkbook: async ({ file, dryRun }) => {
    set({ loading: true, error: null, result: null });
    try {
      const base64 = await fileToBase64(file);
      const api = getApi();
      const res = await api.post('/bulk/import-xlsx', { base64, dryRun: Boolean(dryRun) }, { timeout: 120_000 });
      set({ loading: false, result: res?.data?.data || null });
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Import failed';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useBulkImportStore;

