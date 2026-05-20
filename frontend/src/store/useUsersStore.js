import { create } from 'zustand';
import useAdminAuthStore from './useAdminAuthStore';
import { createAdminApi } from '../utils/adminApi';
import { tRaw } from '../i18n/tRaw';

function isValidId(id) {
  const n = Number(id);
  return Number.isFinite(n) && n > 0;
}

function getApi() {
  const { token } = useAdminAuthStore.getState();
  return createAdminApi({ token });
}

const useUsersStore = create((set, get) => ({
  users: [],
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/users/');
      const users = Array.isArray(res?.data?.data) ? res.data.data : [];
      const safeUsers = users.filter((u) => u && isValidId(u.id));
      set({ users: safeUsers, loading: false, lastSyncAt: Date.now() });
      return safeUsers;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToLoadUsers');
      set({ loading: false, error: msg });
      return [];
    }
  },

  createUser: async ({ name, email, password, role }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const body = { name, email, role };
      if (typeof password === 'string') body.password = password;
      const res = await api.post('/users/', body);
      const created = res?.data?.data;
      let nextUsers = null;
      if (created && isValidId(created.id)) {
        nextUsers = [created, ...get().users].filter((u) => u && isValidId(u.id));
      } else {
        const listRes = await api.get('/users/');
        const users = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
        nextUsers = users.filter((u) => u && isValidId(u.id));
      }
      set({ users: nextUsers, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToCreateUser');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  updateUserRole: async ({ id, role }) => {
    set({ loading: true, error: null });
    try {
      if (!isValidId(id)) {
        const msg = tRaw('failedToUpdateRole');
        set({ loading: false, error: msg });
        throw new Error(msg);
      }
      const api = getApi();
      const res = await api.patch(`/users/${encodeURIComponent(id)}/role/`, { role });
      const updated = res?.data?.data;
      const users = get().users.map((u) => (String(u.id) === String(id) ? updated : u));
      set({ users, loading: false, lastSyncAt: Date.now() });
      return updated;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToUpdateRole');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  deleteUser: async ({ id }) => {
    set({ loading: true, error: null });
    try {
      if (!isValidId(id)) {
        const msg = tRaw('failedToDeleteUser');
        set({ loading: false, error: msg });
        throw new Error(msg);
      }
      const api = getApi();
      await api.delete(`/users/${encodeURIComponent(id)}/`);
      const users = get().users.filter((u) => String(u.id) !== String(id));
      set({ users, loading: false, lastSyncAt: Date.now() });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToDeleteUser');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  resetUserPassword: async ({ id, newPassword }) => {
    set({ loading: true, error: null });
    try {
      if (!isValidId(id)) {
        const msg = tRaw('failedToResetPassword');
        set({ loading: false, error: msg });
        throw new Error(msg);
      }
      const api = getApi();
      const res = await api.post(`/users/${encodeURIComponent(id)}/reset-password/`, { password: newPassword });
      set({ loading: false, lastSyncAt: Date.now() });
      return res?.data?.data || { ok: true };
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToResetPassword');
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useUsersStore;
