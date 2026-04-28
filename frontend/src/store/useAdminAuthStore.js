import { create } from 'zustand';
import { ADMIN_KEYS } from '../utils/adminKeys';
import { readJson, removeKey, writeJson } from '../utils/storage';
import { createAdminApi } from '../utils/adminApi';

function normalizeMode(mode) {
  return mode === 'mock' ? 'mock' : 'backend';
}

function makeMockSession(email) {
  return {
    token: 'mock-admin-token',
    user: {
      id: 'mock-admin',
      email,
      name: 'Demo Admin'
    }
  };
}

const useAdminAuthStore = create((set, get) => ({
  mode: normalizeMode(readJson(ADMIN_KEYS.mode, 'backend')),
  token: readJson(ADMIN_KEYS.token, null),
  user: readJson(ADMIN_KEYS.user, null),
  orgCode: String(readJson(ADMIN_KEYS.orgCode, 'DEMO') || 'DEMO').trim() || 'DEMO',
  loading: false,
  error: null,

  setMode: (mode) => {
    const next = normalizeMode(mode);
    writeJson(ADMIN_KEYS.mode, next);
    set({ mode: next });
  },

  setOrgCode: (orgCode) => {
    const next = String(orgCode || '').trim().toUpperCase() || 'DEMO';
    writeJson(ADMIN_KEYS.orgCode, next);
    set({ orgCode: next });
  },

  logout: () => {
    removeKey(ADMIN_KEYS.token);
    removeKey(ADMIN_KEYS.user);
    set({ token: null, user: null, error: null });
  },

  login: async ({ email, password }) => {
    const { mode } = get();
    set({ loading: true, error: null });

    if (mode === 'mock') {
      const session = makeMockSession(email);
      writeJson(ADMIN_KEYS.token, session.token);
      writeJson(ADMIN_KEYS.user, session.user);
      set({ token: session.token, user: session.user, loading: false });
      return;
    }

    try {
      const api = createAdminApi({ token: null });
      const res = await api.post('/auth/login', { email, password });
      const token = res?.data?.data?.token;
      const user = res?.data?.data?.user;
      if (!token || !user) throw new Error('Login response invalid');
      writeJson(ADMIN_KEYS.token, token);
      writeJson(ADMIN_KEYS.user, user);
      set({ token, user, loading: false });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Login failed';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useAdminAuthStore;
