import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useUploadsStore = create(() => ({
  uploadMedia: async ({ file }) => {
    const api = getApi();
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/uploads/media', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000
    });
    return res?.data?.data;
  }
}));

export default useUploadsStore;

