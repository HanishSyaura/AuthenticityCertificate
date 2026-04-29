import { create } from 'zustand';
import { ADMIN_KEYS } from '../utils/adminKeys';
import { readJson, removeKey, writeJson } from '../utils/storage';
import { createAdminApi } from '../utils/adminApi';

const useAdminAuthStore = create((set, get) => ({
  token: readJson(ADMIN_KEYS.token, null),
  user: readJson(ADMIN_KEYS.user, null),
  loading: false,
  error: null,

  logout: () => {
    removeKey(ADMIN_KEYS.token);
    removeKey(ADMIN_KEYS.user);
    set({ token: null, user: null, error: null });
  },

  login: async ({ email, password }) => {
    set({ loading: true, error: null });

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
