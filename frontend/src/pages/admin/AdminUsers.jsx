import React, { useEffect, useMemo, useState } from 'react';
import useUsersStore from '../../store/useUsersStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAccessStore from '../../store/useAccessStore';
import { useT } from '../../i18n/useT';
import { hasPermission } from '../../utils/permissions';
import DataTable from '../../components/ui/DataTable';
import RowActionsMenu from '../../components/ui/RowActionsMenu';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function groupKeyForPermission(key) {
  const k = String(key || '').trim();
  if (!k) return 'other';
  if (k === '*') return 'system';
  const head = k.split('.')[0] || 'other';
  return head;
}

function groupLabelForPermissionGroup(groupKey) {
  const g = String(groupKey || '').trim();
  const map = {
    system: 'System',
    users: 'Users',
    access: 'Access',
    products: 'Products',
    categories: 'Categories',
    epc: 'EPC',
    certificates: 'Certificates',
    templates: 'Templates',
    cms: 'CMS',
    media: 'Media',
    uploads: 'Uploads',
    identities: 'Identities',
    bulk: 'Bulk',
    analytics: 'Analytics',
    fraud: 'Fraud',
    audit: 'Audit',
    integrations: 'Integrations',
    organizations: 'Organizations',
    settings: 'Settings',
    other: 'Other'
  };
  return map[g] || 'Other';
}

function permissionGroupOrder(groupKey) {
  const order = [
    'system',
    'users',
    'access',
    'products',
    'categories',
    'epc',
    'certificates',
    'templates',
    'cms',
    'media',
    'uploads',
    'identities',
    'bulk',
    'analytics',
    'fraud',
    'audit',
    'integrations',
    'organizations',
    'settings',
    'other'
  ];
  const i = order.indexOf(String(groupKey || ''));
  return i === -1 ? 999 : i;
}

export default function AdminUsers() {
  const { t } = useT();
  const authUser = useAdminAuthStore((s) => s.user);
  const role = authUser?.role || 'admin';
  const perms = authUser?.permissions || [];
  const canManageUsers = role === 'super_admin' || hasPermission(perms, 'users.manage');
  const canManageAccess = role === 'super_admin' || hasPermission(perms, 'access.manage');

  const { users, loading, error, lastSyncAt, fetchUsers, createUser, updateUserRole, deleteUser, resetUserPassword } =
    useUsersStore((s) => ({
    users: s.users,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchUsers: s.fetchUsers,
    createUser: s.createUser,
    updateUserRole: s.updateUserRole,
    deleteUser: s.deleteUser,
    resetUserPassword: s.resetUserPassword
  }));

  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showAccess, setShowAccess] = useState(false);
  const [showUserRoles, setShowUserRoles] = useState(false);
  const [rolesUser, setRolesUser] = useState(null);
  const [selectedUserRoleIds, setSelectedUserRoleIds] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState('admin');

  useEffect(() => {
    if (canManageUsers) void fetchUsers();
  }, [canManageUsers, fetchUsers]);

  const { roles, permissions, fetchRoles, fetchPermissions, setRolePermissions, createRole: createAccessRole, deleteRole: deleteAccessRole, setUserRoles } =
    useAccessStore((s) => ({
    roles: s.roles,
    permissions: s.permissions,
    fetchRoles: s.fetchRoles,
    fetchPermissions: s.fetchPermissions,
    setRolePermissions: s.setRolePermissions,
    createRole: s.createRole,
    deleteRole: s.deleteRole,
    setUserRoles: s.setUserRoles
  }));

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [permQuery, setPermQuery] = useState('');

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const n = String(u?.name || '').toLowerCase();
      const e = String(u?.email || '').toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [users, query]);

  const selectedRole = useMemo(() => {
    if (!selectedRoleId) return null;
    return roles.find((r) => String(r.id) === String(selectedRoleId)) || null;
  }, [roles, selectedRoleId]);

  if (!canManageUsers && !canManageAccess) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <h2 className="text-base font-semibold text-zinc-900">{t('usersRoles')}</h2>
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          {t('superAdminOnly')}
        </div>
      </div>
    );
  }

  const hasFullAccess = selectedPermissionKeys.includes('*');
  const permissionGroups = useMemo(() => {
    const q = String(permQuery || '').trim().toLowerCase();
    const rows = (permissions || []).filter((p) => {
      const key = String(p?.key || '').toLowerCase();
      const desc = String(p?.description || '').toLowerCase();
      if (!q) return true;
      return key.includes(q) || desc.includes(q);
    });

    const map = new Map();
    for (const p of rows) {
      const g = groupKeyForPermission(p?.key);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    }

    const groups = Array.from(map.entries())
      .map(([groupKey, items]) => ({
        groupKey,
        title: groupLabelForPermissionGroup(groupKey),
        items: (items || []).slice().sort((a, b) => String(a?.key || '').localeCompare(String(b?.key || '')))
      }))
      .sort((a, b) => permissionGroupOrder(a.groupKey) - permissionGroupOrder(b.groupKey) || a.title.localeCompare(b.title));

    return groups;
  }, [permissions, permQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('usersRoles')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('usersSubtitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            {canManageUsers ? (
              <button type="button" className="underline" onClick={() => void fetchUsers()}>
                {t('refresh')}
              </button>
            ) : null}
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManageAccess ? (
            <button
              type="button"
              className="ac-btn ac-btn-soft px-3 py-2 text-xs"
              onClick={async () => {
                const [, fetchedRoles] = await Promise.all([fetchPermissions(), fetchRoles()]);
                const first = Array.isArray(fetchedRoles) && fetchedRoles.length > 0 ? fetchedRoles[0] : null;
                if (first?.id) {
                  setSelectedRoleId(first.id);
                  setSelectedPermissionKeys(Array.isArray(first.permissions) ? first.permissions : []);
                }
                setPermQuery('');
                setShowAccess(true);
              }}
            >
              Manage access
            </button>
          ) : null}
          {canManageUsers ? (
            <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => setShowCreate(true)}>
              {t('createUser')}
            </button>
          ) : null}
        </div>
      </div>

      {canManageUsers ? (
        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchUsers')}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          You can manage roles and permissions, but you do not have permission to view/manage users.
        </div>
      )}

      {canManageUsers && error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
      ) : null}

      {canManageUsers ? (
        <DataTable
          minWidth={820}
          rows={filtered}
          rowKey={(u) => u.id}
          loading={loading}
          loadingContent={t('loading')}
          emptyContent={
            <div>
              <div className="text-sm font-semibold text-zinc-900">{t('noUsers')}</div>
              <div className="mt-1 text-xs text-zinc-600">{t('noUsersHint')}</div>
            </div>
          }
          columns={[
          {
            id: 'user',
            header: t('user'),
            cell: (u) => (
              <div>
                <div className="font-medium text-zinc-900">{u.name}</div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{u.email}</div>
              </div>
            )
          },
          {
            id: 'role',
            header: t('role'),
            cell: (u) => {
              const disabled = String(u.email) === String(authUser?.email);
              return (
                <div>
                  <select
                    value={u.role}
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      const role = e.target.value;
                      await updateUserRole({ id: u.id, role });
                    }}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                  >
                    <option value="super_admin">super_admin</option>
                    <option value="admin">admin</option>
                    <option value="operator">operator</option>
                  </select>
                  {canManageAccess ? (
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-zinc-600 underline disabled:text-zinc-400"
                      disabled={disabled}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (roles.length === 0) await fetchRoles();
                        setRolesUser(u);
                        const selected = (roles || [])
                          .filter((r) => (u.roles || []).includes(r.name) || String(u.role) === String(r.name))
                          .map((r) => r.id);
                        setSelectedUserRoleIds(Array.from(new Set(selected)));
                        setShowUserRoles(true);
                      }}
                    >
                      Edit access
                    </button>
                  ) : null}
                  {Array.isArray(u.roles) && u.roles.length > 0 ? (
                    <div className="mt-1 text-[11px] text-zinc-500">{u.roles.join(', ')}</div>
                  ) : null}
                </div>
              );
            }
          },
          {
            id: 'status',
            header: t('status'),
            cell: (u) => (
              <div className="text-xs text-zinc-700">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{t('active')}</span>
                <div className="mt-1 text-[11px] text-zinc-500">{formatDate(u.updatedAt || u.createdAt)}</div>
              </div>
            )
          },
          {
            id: 'actions',
            header: t('actions'),
            align: 'right',
            cell: (u) => {
              const disabled = String(u.email) === String(authUser?.email);
              return (
                <RowActionsMenu
                  ariaLabel={t('actions')}
                  items={[
                    {
                      key: 'reset',
                      label: t('resetPassword'),
                      disabled,
                      onSelect: () => {
                        setResetUser(u);
                        setResetPassword('');
                        setShowReset(true);
                      }
                    },
                    {
                      key: 'delete',
                      label: t('delete'),
                      tone: 'danger',
                      disabled,
                      onSelect: async () => {
                        if (!window.confirm(t('confirmDeleteUser'))) return;
                        await deleteUser({ id: u.id });
                      }
                    }
                  ]}
                />
              );
            },
            headerClassName: 'pr-3',
            className: 'pr-3'
          }
          ]}
        />
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createUser')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('name')}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('email')}</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('password')}</div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
                <div className="mt-1 text-[11px] text-zinc-500">{t('minPasswordHint')}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('role')}</div>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="admin">admin</option>
                  <option value="operator">operator</option>
                  <option value="super_admin">super_admin</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowCreate(false);
                  setName('');
                  setEmail('');
                  setPassword('');
                  setNewRole('admin');
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                onClick={async () => {
                  const nm = String(name || '').trim();
                  const em = String(email || '').trim();
                  const pw = String(password || '');
                  if (!nm || !em || !pw) return;
                  await createUser({ name: nm, email: em, password: pw, role: newRole });
                  setShowCreate(false);
                  setName('');
                  setEmail('');
                  setPassword('');
                  setNewRole('admin');
                }}
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('resetPassword')}</div>
            <div className="text-xs text-zinc-600">
              {resetUser?.email}
              <div className="mt-1 text-[11px] text-zinc-500">{t('resetPasswordHint')}</div>
            </div>
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold text-zinc-600">{t('newPassword')}</div>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              <div className="mt-1 text-[11px] text-zinc-500">{t('minPasswordHint')}</div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowReset(false);
                  setResetUser(null);
                  setResetPassword('');
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!resetUser?.id || !resetPassword}
                onClick={async () => {
                  await resetUserPassword({ id: resetUser.id, newPassword: resetPassword });
                  setShowReset(false);
                  setResetUser(null);
                  setResetPassword('');
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showUserRoles ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5">
            <div className="mb-4">
              <div className="text-sm font-semibold text-zinc-900">Edit access</div>
              <div className="mt-1 text-xs text-zinc-600">{rolesUser?.email}</div>
            </div>
            <div className="max-h-[50vh] overflow-auto rounded-xl border border-zinc-200 bg-white">
              {roles.length === 0 ? (
                <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
              ) : (
                roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-sm last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selectedUserRoleIds.includes(r.id)}
                      onChange={(e) => {
                        const next = new Set(selectedUserRoleIds);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        setSelectedUserRoleIds(Array.from(next));
                      }}
                    />
                    <span className="font-medium text-zinc-900">{r.name}</span>
                    {r.isSystem ? <span className="text-[11px] text-zinc-500">system</span> : null}
                  </label>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowUserRoles(false);
                  setRolesUser(null);
                  setSelectedUserRoleIds([]);
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!rolesUser?.id}
                onClick={async () => {
                  await setUserRoles({ userId: rolesUser.id, roleIds: selectedUserRoleIds });
                  await fetchUsers();
                  setShowUserRoles(false);
                  setRolesUser(null);
                  setSelectedUserRoleIds([]);
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAccess ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Access management</div>
                <div className="mt-1 text-xs text-zinc-600">Edit role permissions</div>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowAccess(false);
                }}
              >
                {t('close')}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="rounded-xl border border-zinc-200 p-3">
                <div className="mb-2 text-xs font-semibold text-zinc-600">Roles</div>
                <select
                  value={selectedRoleId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedRoleId(id);
                    const nextRole = roles.find((r) => String(r.id) === String(id));
                    setSelectedPermissionKeys(Array.isArray(nextRole?.permissions) ? nextRole.permissions : []);
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="" disabled>
                    Select a role
                  </option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {selectedRole && !selectedRole.isSystem ? (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                    onClick={async () => {
                      if (!window.confirm('Delete this role?')) return;
                      await deleteAccessRole({ roleId: selectedRole.id });
                      const nextRoles = await fetchRoles();
                      const first = Array.isArray(nextRoles) && nextRoles.length > 0 ? nextRoles[0] : null;
                      setSelectedRoleId(first?.id || null);
                      setSelectedPermissionKeys(Array.isArray(first?.permissions) ? first.permissions : []);
                    }}
                  >
                    Delete role
                  </button>
                ) : null}

                <div className="mt-4 border-t border-zinc-200 pt-3">
                  <div className="mb-2 text-xs font-semibold text-zinc-600">Create role</div>
                  <input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="role.name"
                    className="mb-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <input
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <button
                    type="button"
                    className="mt-2 w-full ac-btn px-3 py-2 text-xs"
                    disabled={!String(newRoleName || '').trim()}
                    onClick={async () => {
                      const name = String(newRoleName || '').trim();
                      const description = String(newRoleDesc || '').trim();
                      const created = await createAccessRole({ name, description: description || undefined });
                      await fetchRoles();
                      setSelectedRoleId(created?.id || null);
                      setSelectedPermissionKeys([]);
                      setNewRoleName('');
                      setNewRoleDesc('');
                    }}
                  >
                    {t('create')}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-zinc-600">Permissions</div>
                  <button
                    type="button"
                    className="ac-btn px-3 py-2 text-xs"
                    disabled={!selectedRole?.id}
                    onClick={async () => {
                      await setRolePermissions({ roleId: selectedRole.id, permissionKeys: selectedPermissionKeys });
                      await fetchRoles();
                    }}
                  >
                    {t('save')}
                  </button>
                </div>
                <div className="mb-2">
                  <input
                    value={permQuery}
                    onChange={(e) => setPermQuery(e.target.value)}
                    placeholder="Search permissions…"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div className="max-h-[55vh] overflow-auto rounded-xl border border-zinc-200">
                  {permissions.length === 0 ? (
                    <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
                  ) : (
                    <div>
                      {permissionGroups.map((g) => {
                        const keys = (g.items || []).map((p) => p.key).filter((k) => k !== '*');
                        const checkedCount = keys.filter((k) => selectedPermissionKeys.includes(k)).length;
                        const allChecked = keys.length > 0 && checkedCount === keys.length;
                        const someChecked = checkedCount > 0 && checkedCount < keys.length;
                        return (
                          <div key={g.groupKey} className="border-b border-zinc-100 last:border-b-0">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-white px-4 py-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{g.title}</div>
                              {g.groupKey !== 'system' ? (
                                <label className="flex items-center gap-2 text-xs text-zinc-700">
                                  <input
                                    type="checkbox"
                                    disabled={!selectedRole?.id || hasFullAccess || keys.length === 0}
                                    checked={allChecked}
                                    ref={(el) => {
                                      if (el) el.indeterminate = Boolean(someChecked);
                                    }}
                                    onChange={(e) => {
                                      const next = new Set(selectedPermissionKeys);
                                      if (e.target.checked) {
                                        for (const k of keys) next.add(k);
                                      } else {
                                        for (const k of keys) next.delete(k);
                                      }
                                      setSelectedPermissionKeys(Array.from(next));
                                    }}
                                  />
                                  All
                                </label>
                              ) : null}
                            </div>
                            {(g.items || []).map((p) => (
                              <label key={p.id} className="flex items-start gap-2 px-4 py-3">
                                <input
                                  type="checkbox"
                                  disabled={!selectedRole?.id || (hasFullAccess && p.key !== '*')}
                                  checked={selectedPermissionKeys.includes(p.key)}
                                  onChange={(e) => {
                                    if (p.key === '*') {
                                      if (e.target.checked) setSelectedPermissionKeys(['*']);
                                      else setSelectedPermissionKeys(selectedPermissionKeys.filter((k) => k !== '*'));
                                      return;
                                    }
                                    const next = new Set(selectedPermissionKeys.filter((k) => k !== '*'));
                                    if (e.target.checked) next.add(p.key);
                                    else next.delete(p.key);
                                    setSelectedPermissionKeys(Array.from(next));
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-zinc-900">{p.key}</div>
                                  {p.description ? <div className="mt-0.5 text-[11px] text-zinc-500">{p.description}</div> : null}
                                </div>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
