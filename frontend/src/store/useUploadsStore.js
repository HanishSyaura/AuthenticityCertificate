import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';
import { isFileTooLarge, MAX_UPLOAD_MB } from '../utils/uploadLimits';
import { tRaw } from '../i18n/tRaw';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

function tryExtractMaxMb(message) {
  const m = String(message || '').match(/(\d+)\s*mb\b/i);
  const n = m ? Number.parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const useUploadsStore = create(() => ({
  uploadMedia: async ({ file, onProgress }) => {
    if (isFileTooLarge(file)) {
      throw new Error(tRaw('fileTooLargeMaxMb', { mb: MAX_UPLOAD_MB }));
    }
    const api = getApi();
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/uploads/media', form, {
        timeout: 300_000,
        onUploadProgress: (evt) => {
          if (typeof onProgress !== 'function') return;
          const loaded = Number(evt?.loaded) || 0;
          const totalRaw = Number(evt?.total);
          const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null;
          const percent = total ? (loaded / total) * 100 : null;
          onProgress({ loaded, total, percent });
        }
      });
      return res?.data?.data;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 413) {
        const serverMb = tryExtractMaxMb(e?.response?.data?.message);
        throw new Error(tRaw('fileTooLargeMaxMb', { mb: serverMb || MAX_UPLOAD_MB }));
      }
      throw e;
    }
  }
}));

export default useUploadsStore;
