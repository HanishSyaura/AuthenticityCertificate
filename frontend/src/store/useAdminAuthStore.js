import { create } from 'zustand';
import { ADMIN_KEYS } from '../utils/adminKeys';
import { readJson, removeKey, writeJson } from '../utils/storage';
import { createAdminApi } from '../utils/adminApi';

const useAdminAuthStore = create((set) => ({
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
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      let msg = serverMsg || e?.message || 'Login failed';
      if (msg === 'db_timeout') msg = 'Database temporarily unavailable';
      if (status === 401 && (!serverMsg || serverMsg === 'Unauthorized')) msg = 'Invalid email or password';
      if (status === 503 && !serverMsg) msg = 'Service temporarily unavailable';
      if (e?.code === 'ECONNABORTED') msg = 'Request timed out. Please try again.';
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useAdminAuthStore;
