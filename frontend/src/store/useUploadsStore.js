import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';
import { isFileTooLarge, MAX_UPLOAD_MB } from '../utils/uploadLimits';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useUploadsStore = create(() => ({
  uploadMedia: async ({ file }) => {
    if (isFileTooLarge(file)) {
      throw new Error(`File too large. Maximum file size is ${MAX_UPLOAD_MB}MB.`);
    }
    const api = getApi();
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/uploads/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000
      });
      return res?.data?.data;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 413) {
        throw new Error(`File too large. Maximum file size is ${MAX_UPLOAD_MB}MB.`);
      }
      throw e;
    }
  }
}));

export default useUploadsStore;
