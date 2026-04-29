import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useIntegrationsStore = create((set, get) => ({
  apiKeys: [],
  webhooks: [],
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const [keysRes, hooksRes] = await Promise.all([api.get('/integrations/api-keys'), api.get('/integrations/webhooks')]);
      const apiKeys = Array.isArray(keysRes?.data?.data) ? keysRes.data.data : [];
      const webhooks = Array.isArray(hooksRes?.data?.data) ? hooksRes.data.data : [];
      set({ apiKeys, webhooks, loading: false, lastSyncAt: Date.now() });
      return { apiKeys, webhooks };
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load integrations';
      set({ loading: false, error: msg });
      return null;
    }
  },

  createApiKey: async ({ name, rateLimitPerMin }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/integrations/api-keys', {
        name,
        rateLimitPerMin: rateLimitPerMin != null && String(rateLimitPerMin).trim() !== '' ? Number(rateLimitPerMin) : undefined
      });
      const created = res?.data?.data;
      const apiKeys = [created, ...get().apiKeys].filter(Boolean);
      set({ apiKeys, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Create API key failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  revokeApiKey: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post(`/integrations/api-keys/${encodeURIComponent(id)}/revoke`);
      const updated = res?.data?.data;
      const apiKeys = get().apiKeys.map((k) => (String(k.id) === String(id) ? { ...k, revokedAt: updated?.revokedAt || new Date().toISOString() } : k));
      set({ apiKeys, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Revoke API key failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  createWebhook: async ({ url, secret, events }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/integrations/webhooks', { url, secret, events });
      const created = res?.data?.data;
      const webhooks = [created, ...get().webhooks].filter(Boolean);
      set({ webhooks, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Create webhook failed';
      set({ loading: false, error: msg });
      throw e;
    }
  },

  setWebhookActive: async ({ id, isActive }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.patch(`/integrations/webhooks/${encodeURIComponent(id)}`, { isActive: Boolean(isActive) });
      const updated = res?.data?.data;
      const webhooks = get().webhooks.map((h) => (String(h.id) === String(id) ? { ...h, isActive: updated?.isActive } : h));
      set({ webhooks, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Update webhook failed';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useIntegrationsStore;

