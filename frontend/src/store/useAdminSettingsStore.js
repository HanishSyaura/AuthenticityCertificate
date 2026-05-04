import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useAdminSettingsStore = create((set) => ({
  organization: null,
  settings: null,
  loading: false,
  error: null,
  lastSyncAt: null,

  setSettingsResponse: ({ organization, settings }) => {
    set({
      organization: organization || null,
      settings: settings || null,
      error: null,
      lastSyncAt: Date.now()
    });
  },

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/settings');
      const organization = res?.data?.data?.organization || null;
      const settings = res?.data?.data?.settings || null;
      set({ organization, settings, loading: false, lastSyncAt: Date.now() });
      return { organization, settings };
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load settings';
      set({ loading: false, error: msg });
      return null;
    }
  }
}));

export default useAdminSettingsStore;

