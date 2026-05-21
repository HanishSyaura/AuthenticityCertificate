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

const useAccessStore = create((set, get) => ({
  permissions: [],
  roles: [],
  loading: false,
  error: null,
  lastSyncAt: null,

  fetchPermissions: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/access/permissions');
      const permissions = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ permissions, loading: false, lastSyncAt: Date.now() });
      return permissions;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToLoadPermissions');
      set({ loading: false, error: msg });
      return [];
    }
  },

  fetchRoles: async () => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.get('/access/roles');
      const roles = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ roles, loading: false, lastSyncAt: Date.now() });
      return roles;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToLoadRoles');
      set({ loading: false, error: msg });
      return [];
    }
  },

  createRole: async ({ name, description }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.post('/access/roles', { name, description });
      const created = res?.data?.data;
      const roles = [created, ...get().roles].filter(Boolean);
      set({ roles, loading: false, lastSyncAt: Date.now() });
      return created;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToCreateRole');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  setRolePermissions: async ({ roleId, permissionKeys }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      const res = await api.put(`/access/roles/${encodeURIComponent(roleId)}/permissions`, { permissionKeys });
      const payload = res?.data?.data;
      const roles = get().roles.map((r) => (String(r.id) === String(roleId) ? { ...r, permissions: payload.permissions } : r));
      set({ roles, loading: false, lastSyncAt: Date.now() });
      await useAdminAuthStore.getState().fetchMe();
      return payload;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToUpdatePermissions');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  deleteRole: async ({ roleId }) => {
    set({ loading: true, error: null });
    try {
      const api = getApi();
      await api.delete(`/access/roles/${encodeURIComponent(roleId)}/`);
      const roles = get().roles.filter((r) => String(r.id) !== String(roleId));
      set({ roles, loading: false, lastSyncAt: Date.now() });
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToDeleteRole');
      set({ loading: false, error: msg });
      throw e;
    }
  },

  setUserRoles: async ({ userId, roleIds }) => {
    set({ loading: true, error: null });
    try {
      if (!isValidId(userId)) {
        const msg = tRaw('failedToUpdateUserRoles');
        set({ loading: false, error: msg });
        throw new Error(msg);
      }
      const api = getApi();
      const res = await api.put(`/access/users/${encodeURIComponent(userId)}/roles`, { roleIds });
      set({ loading: false, lastSyncAt: Date.now() });
      await useAdminAuthStore.getState().fetchMe();
      return res?.data?.data;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || tRaw('failedToUpdateUserRoles');
      set({ loading: false, error: msg });
      throw e;
    }
  }
}));

export default useAccessStore;
