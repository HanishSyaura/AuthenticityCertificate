import { create } from 'zustand';
import { ADMIN_KEYS } from '../utils/adminKeys';
import { readJson, removeKey, writeJson } from '../utils/storage';
import { createAdminApi } from '../utils/adminApi';
import { tRaw } from '../i18n/tRaw';

const useAdminAuthStore = create((set) => ({
  token: readJson(ADMIN_KEYS.token, null),
  user: readJson(ADMIN_KEYS.user, null),
  loading: false,
  error: null,

  setUser: (user) => {
    writeJson(ADMIN_KEYS.user, user);
    set({ user });
  },

  fetchMe: async () => {
    const { token } = useAdminAuthStore.getState();
    if (!token) return null;
    set({ loading: true, error: null });
    try {
      const api = createAdminApi({ token });
      const res = await api.get('/auth/me');
      const user = res?.data?.data?.user;
      if (!user) throw new Error(tRaw('sessionInvalid'));
      writeJson(ADMIN_KEYS.user, user);
      set({ user, loading: false });
      return user;
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        removeKey(ADMIN_KEYS.token);
        removeKey(ADMIN_KEYS.user);
        set({ token: null, user: null, loading: false, error: null });
        return null;
      }
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToLoadSession');
      set({ loading: false, error: msg });
      return null;
    }
  },

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
      if (!token || !user) throw new Error(tRaw('loginResponseInvalid'));
      writeJson(ADMIN_KEYS.token, token);
      writeJson(ADMIN_KEYS.user, user);
      set({ token, user, loading: false });
      await useAdminAuthStore.getState().fetchMe();
    } catch (e) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      let msg = serverMsg || e?.message || tRaw('loginFailed');
      if (msg === 'db_timeout') msg = tRaw('dbTemporarilyUnavailable');
      if (status === 401 && (!serverMsg || serverMsg === 'Unauthorized')) msg = tRaw('invalidEmailOrPassword');
      if (status === 503 && !serverMsg) msg = tRaw('serviceTemporarilyUnavailable');
      if (e?.code === 'ECONNABORTED') msg = tRaw('requestTimedOut');
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useAdminAuthStore;
