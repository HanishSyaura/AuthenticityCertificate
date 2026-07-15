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
  uploadMedia: async ({ file, onProgress, onStage }) => {
    if (isFileTooLarge(file)) {
      throw new Error(tRaw('fileTooLargeMaxMb', { mb: MAX_UPLOAD_MB }));
    }
    const api = getApi();
    const form = new FormData();
    form.append('file', file);
    const isVideo = String(file?.type || '')
      .trim()
      .toLowerCase()
      .startsWith('video/');
    try {
      if (typeof onStage === 'function') onStage('uploading');
      const res = await api.post('/uploads/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Video upload may finish sending quickly but still needs server-side transcode before response returns.
        timeout: isVideo ? 0 : 300_000,
        onUploadProgress: (evt) => {
          const total = Number(evt?.total || 0);
          if (!total || typeof onProgress !== 'function') return;
          const loaded = Number(evt?.loaded || 0);
          const pct = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
          onProgress(pct);
          if (pct >= 100 && typeof onStage === 'function') onStage('processing');
        }
      });
      if (typeof onStage === 'function') onStage('done');
      return res?.data?.data;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 413) {
        const serverMb = tryExtractMaxMb(e?.response?.data?.message);
        throw new Error(tRaw('fileTooLargeMaxMb', { mb: serverMb || MAX_UPLOAD_MB }));
      }
      if (e?.code === 'ECONNABORTED') {
        throw new Error(tRaw('requestTimedOut'));
      }
      throw e;
    }
  }
}));

export default useUploadsStore;
