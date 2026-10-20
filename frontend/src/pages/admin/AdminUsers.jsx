import React, { useEffect, useMemo, useState } from 'react';
import useUsersStore from '../../store/useUsersStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAccessStore from '../../store/useAccessStore';
import { useT } from '../../i18n/useT';
import { hasPermission } from '../../utils/permissions';
import { PERMISSION_GROUPS, VISIBLE_PERMISSION_KEYS } from '../../utils/permissionCatalog';
import DataTable from '../../components/ui/DataTable';
import TablePager from '../../components/ui/TablePager';
import RowActionsMenu from '../../components/ui/RowActionsMenu';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function RefreshIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function UsersIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ClockIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function SearchIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SectionShell({ title, hint, action, children }) {
  const hasHeader = Boolean(title || hint || action);
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {title ? <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
            {hint ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{hint}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={hasHeader ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

function SummaryCard({ icon, label, value, muted = false }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
          <div className={`mt-2 truncate text-lg font-semibold tracking-tight ${muted ? 'text-slate-700' : 'text-slate-950'}`}>{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { t } = useT();
  const authUser = useAdminAuthStore((s) => s.user);
  const role = authUser?.role || 'admin';
  const perms = authUser?.permissions || [];
  const canManageUsers = role === 'super_admin' || hasPermission(perms, 'users.manage');
  const canManageAccess = role === 'super_admin' || hasPermission(perms, 'access.manage');

  const { users, loading, error, lastSyncAt, fetchUsers, createUser, deleteUser, resetUserPassword } =
    useUsersStore((s) => ({
    users: s.users,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchUsers: s.fetchUsers,
    createUser: s.createUser,
    deleteUser: s.deleteUser,
    resetUserPassword: s.resetUserPassword
  }));

  const [query, setQuery] = useState('');
  const [tableOffset, setTableOffset] = useState(0);
  const [tableLimit, setTableLimit] = useState(50);
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
  const [selectedCreateRoleIds, setSelectedCreateRoleIds] = useState([]);
  const [createNotice, setCreateNotice] = useState('');

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

  useEffect(() => {
    setTableOffset(0);
  }, [query]);

  const paged = useMemo(() => {
    const total = filtered.length;
    const safeOffset = total === 0 ? 0 : Math.max(0, Math.min(tableOffset, Math.max(0, total - 1)));
    return filtered.slice(safeOffset, safeOffset + tableLimit);
  }, [filtered, tableLimit, tableOffset]);

  const selectedRole = useMemo(() => {
    if (!selectedRoleId) return null;
    return roles.find((r) => String(r.id) === String(selectedRoleId)) || null;
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (canManageAccess) void fetchRoles();
  }, [canManageAccess, fetchRoles]);

  useEffect(() => {
    if (!showCreate) return;
    if (!canManageAccess) return;
    if (selectedCreateRoleIds.length > 0) return;
    const adminRole = roles.find((r) => r?.isSystem && String(r?.name) === 'admin');
    if (adminRole?.id) setSelectedCreateRoleIds([adminRole.id]);
  }, [canManageAccess, roles, selectedCreateRoleIds.length, showCreate]);

  const permissionsByKey = useMemo(() => {
    const m = new Map();
    for (const p of Array.isArray(permissions) ? permissions : []) {
      if (p?.key) m.set(p.key, p);
    }
    return m;
  }, [permissions]);

  const visibleKeys = useMemo(() => {
    const set = new Set();
    for (const k of VISIBLE_PERMISSION_KEYS) {
      if (permissionsByKey.has(k)) set.add(k);
    }
    return set;
  }, [permissionsByKey]);

  const permissionGroups = useMemo(() => {
    const q = String(permQuery || '').trim().toLowerCase();
    const groups = PERMISSION_GROUPS.map((g) => {
      const items = (Array.isArray(g.keys) ? g.keys : [])
        .filter((k) => visibleKeys.has(k))
        .map((k) => permissionsByKey.get(k))
        .filter(Boolean);
      const filteredItems =
        !q
          ? items
          : items.filter((p) => {
              const key = String(p?.key || '').toLowerCase();
              const desc = String(p?.description || '').toLowerCase();
              return key.includes(q) || desc.includes(q);
            });
      return { id: g.id, titleKey: g.titleKey, items: filteredItems, allKeys: items.map((p) => p.key), totalItems: items.length };
    });
    return groups.filter((g) => g.totalItems > 0 && g.items.length > 0);
  }, [permQuery, permissionsByKey, visibleKeys]);

  const totalUsers = users.length;
  const filteredUsers = filtered.length;
  const rolesCount = Array.isArray(roles) ? roles.length : 0;
  const refreshedAt = formatDate(lastSyncAt);

  if (!canManageUsers) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <h2 className="text-base font-semibold text-zinc-900">{t('usersRoles')}</h2>
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
          {t('superAdminOnly')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,var(--ac-bg-soft)_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="min-w-0">
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-slate-950">{t('usersRoles')}</h2>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          onClick={() => void fetchUsers()}
          aria-label={t('refresh')}
          title={t('refresh')}
        >
          <RefreshIcon />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={<UsersIcon />} label={t('user')} value={t('total', { value: totalUsers })} />
        <SummaryCard icon={<ShieldIcon />} label={t('roles')} value={canManageAccess ? t('total', { value: rolesCount }) : '-'} muted={!canManageAccess} />
        <SummaryCard icon={<ClockIcon />} label={t('refresh')} value={refreshedAt || '-'} muted={!refreshedAt} />
      </div>

      <SectionShell
        title={t('usersRoles')}
        hint={t('usersSubtitle')}
        action={
          <>
            {canManageAccess ? (
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={async () => {
                  const [fetchedPermissions, fetchedRoles] = await Promise.all([fetchPermissions(), fetchRoles()]);
                  const fetchedKeys = new Set((Array.isArray(fetchedPermissions) ? fetchedPermissions : []).map((p) => p?.key).filter(Boolean));
                  const first = Array.isArray(fetchedRoles) && fetchedRoles.length > 0 ? fetchedRoles[0] : null;
                  if (first?.id) {
                    setSelectedRoleId(first.id);
                    const next = (Array.isArray(first.permissions) ? first.permissions : []).filter((k) => VISIBLE_PERMISSION_KEYS.has(k) && fetchedKeys.has(k));
                    setSelectedPermissionKeys(Array.from(new Set(next)));
                  }
                  setPermQuery('');
                  setShowAccess(true);
                }}
              >
                {t('manageAccess')}
              </button>
            ) : null}
            <button
              type="button"
              className="ac-btn px-3 py-2 text-xs"
              onClick={() => {
                setName('');
                setEmail('');
                setSelectedCreateRoleIds([]);
                setCreateNotice('');
                setShowCreate(true);
                if (canManageAccess && roles.length === 0) void fetchRoles();
              }}
            >
              {t('createUser')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('searchUsers')}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200/70"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-medium shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  {t('showingCount', { from: filteredUsers === 0 ? 0 : 1, to: filteredUsers, total: totalUsers })}
                </div>
                {refreshedAt ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-medium shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    {t('lastUpdated', { value: refreshedAt })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {error ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <DataTable
            minWidth={860}
            density="compact"
            rows={paged}
            rowKey={(u) => u.id}
            loading={loading}
            loadingContent={t('loading')}
            top={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{t('user')}</div>
                <div className="text-xs text-slate-500">{query ? `${filteredUsers} / ${totalUsers}` : t('total', { value: totalUsers })}</div>
              </div>
            }
            emptyContent={
              <div>
                <div className="text-sm font-semibold text-slate-900">{t('noUsers')}</div>
                <div className="mt-1 text-xs text-slate-600">{t('noUsersHint')}</div>
              </div>
            }
            bottom={
              <TablePager
                offset={tableOffset}
                limit={tableLimit}
                total={filtered.length}
                loading={loading}
                onOffsetChange={(next) => setTableOffset(next)}
                onLimitChange={(next) => {
                  setTableLimit(next);
                  setTableOffset(0);
                }}
              />
            }
            columns={[
          {
            id: 'user',
            header: t('user'),
            cell: (u) => (
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                  {String(u?.name || u?.email || '?').trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{u.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">{u.email}</div>
                </div>
              </div>
            )
          },
          {
            id: 'role',
            header: t('role'),
            cell: (u) => {
              const disabled = String(u.email) === String(authUser?.email);
              const roleList = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role].filter(Boolean);
              return (
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {roleList.map((roleName) => (
                      <span key={`${u.id}-${roleName}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {roleName}
                      </span>
                    ))}
                  </div>
                  {canManageAccess ? (
                    <button
                      type="button"
                      className="mt-2 text-[11px] font-medium text-slate-600 underline underline-offset-2 disabled:text-slate-400"
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
                      {t('editAccess')}
                    </button>
                  ) : null}
                </div>
              );
            }
          },
          {
            id: 'status',
            header: t('status'),
            cell: (u) => (
              <div className="text-xs text-slate-700">
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{t('active')}</span>
                <div className="mt-1.5 text-[11px] text-slate-500">{formatDate(u.updatedAt || u.createdAt)}</div>
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
                        if (!u?.id) return;
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
        </div>
      </SectionShell>

      {showCreate ? (
        <div className="ac-overlay-center">
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="mb-4 text-sm font-semibold text-zinc-900">{t('createUser')}</div>
            {createNotice ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                {createNotice}
              </div>
            ) : null}
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
              {canManageAccess && roles.length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-semibold text-zinc-600">{t('accessRoles')}</div>
                  <div className="max-h-44 overflow-auto rounded-xl border border-zinc-200 bg-white">
                    {roles.map((r) => {
                      const checked = selectedCreateRoleIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-sm last:border-b-0 ${
                            ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selectedCreateRoleIds);
                              if (e.target.checked) next.add(r.id);
                              else next.delete(r.id);
                              setSelectedCreateRoleIds(Array.from(next));
                            }}
                          />
                          <span className="font-medium text-zinc-900">{r.name}</span>
                          {r.isSystem ? <span className="text-[11px] text-zinc-500">{t('systemTag')}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">{t('accessRolesHint')}</div>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setShowCreate(false);
                  setName('');
                  setEmail('');
                  setSelectedCreateRoleIds([]);
                  setCreateNotice('');
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
                  if (!nm || !em) return;
                  const created = await createUser({ name: nm, email: em });
                  if (canManageAccess && created?.id && roles.length > 0) {
                    const next = new Set(selectedCreateRoleIds);
                    if (next.size > 0) {
                      await setUserRoles({ userId: created.id, roleIds: Array.from(next) });
                      await fetchUsers();
                    }
                  }
                  const tmp = String(created?.temporaryPassword || '').trim();
                  setCreateNotice(
                    tmp
                      ? t('userCreatedWithTempPassword', { password: tmp })
                      : t('userCreatedWithDefaultPassword')
                  );
                  if (String(query || '').trim()) setQuery('');
                  setName('');
                  setEmail('');
                  setSelectedCreateRoleIds([]);
                }}
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showReset ? (
        <div className="ac-overlay-center">
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
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
                autoComplete="new-password"
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
                disabled={!resetUser?.id || String(resetPassword || '').trim().length < 8}
                onClick={async () => {
                  await resetUserPassword({ id: resetUser.id, newPassword: String(resetPassword || '').trim() });
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
        <div className="ac-overlay-center">
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="mb-4">
              <div className="text-sm font-semibold text-zinc-900">{t('editAccess')}</div>
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
                    {r.isSystem ? <span className="text-[11px] text-zinc-500">{t('systemTag')}</span> : null}
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
        <div className="ac-overlay-center">
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{t('accessManagement')}</div>
                <div className="mt-1 text-xs text-zinc-600">{t('accessManagementHint')}</div>
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
                <div className="mb-2 text-xs font-semibold text-zinc-600">{t('roles')}</div>
                <select
                  value={selectedRoleId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedRoleId(id);
                    const nextRole = roles.find((r) => String(r.id) === String(id));
                    const next = (Array.isArray(nextRole?.permissions) ? nextRole.permissions : []).filter((k) => visibleKeys.has(k));
                    setSelectedPermissionKeys(Array.from(new Set(next)));
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="" disabled>
                    {t('selectRole')}
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
                      if (!window.confirm(t('confirmDeleteRole'))) return;
                      await deleteAccessRole({ roleId: selectedRole.id });
                      const nextRoles = await fetchRoles();
                      const first = Array.isArray(nextRoles) && nextRoles.length > 0 ? nextRoles[0] : null;
                      setSelectedRoleId(first?.id || null);
                      const next = (Array.isArray(first?.permissions) ? first.permissions : []).filter((k) => visibleKeys.has(k));
                      setSelectedPermissionKeys(Array.from(new Set(next)));
                    }}
                  >
                    {t('deleteRole')}
                  </button>
                ) : null}

                <div className="mt-4 border-t border-zinc-200 pt-3">
                  <div className="mb-2 text-xs font-semibold text-zinc-600">{t('createRole')}</div>
                  <input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder={t('roleNamePlaceholder')}
                    className="mb-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <input
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    placeholder={t('descriptionOptional')}
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
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-600">{t('permissions')}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      {selectedRole?.name ? t('selectedRole', { value: selectedRole.name }) : t('selectRole')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                      disabled={!selectedRole?.id}
                      onClick={() => setSelectedPermissionKeys([])}
                    >
                      {t('clearSelection')}
                    </button>
                    <button
                      type="button"
                      className="ac-btn px-3 py-2 text-xs"
                      disabled={!selectedRole?.id}
                      onClick={async () => {
                        const next = selectedPermissionKeys.filter((k) => visibleKeys.has(k));
                        await setRolePermissions({ roleId: selectedRole.id, permissionKeys: Array.from(new Set(next)) });
                        await fetchRoles();
                      }}
                    >
                      {t('save')}
                    </button>
                  </div>
                </div>

                <input
                  value={permQuery}
                  onChange={(e) => setPermQuery(e.target.value)}
                  placeholder={t('searchPermissions')}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />

                <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-zinc-200 bg-white">
                  {permissions.length === 0 ? (
                    <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
                  ) : permissionGroups.length === 0 ? (
                    <div className="p-4 text-sm text-zinc-600">{t('noPermissionsFound')}</div>
                  ) : (
                    permissionGroups.map((g) => {
                      const selectedCount = (Array.isArray(g.allKeys) ? g.allKeys : []).filter((k) => selectedPermissionKeys.includes(k)).length;
                      return (
                        <div key={g.id} className="border-b border-zinc-100 last:border-b-0">
                          <div className="flex items-center justify-between gap-3 bg-zinc-50 px-4 py-3">
                            <div className="text-xs font-semibold text-zinc-800">
                              {t(g.titleKey)}
                              <span className="ml-2 text-[11px] font-normal text-zinc-500">
                                {selectedCount}/{g.totalItems}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                className="underline text-zinc-700 disabled:text-zinc-400"
                                disabled={!selectedRole?.id}
                                onClick={() => {
                                  const next = new Set(selectedPermissionKeys);
                                  for (const k of Array.isArray(g.allKeys) ? g.allKeys : []) next.add(k);
                                  setSelectedPermissionKeys(Array.from(next));
                                }}
                              >
                                {t('selectAll')}
                              </button>
                              <button
                                type="button"
                                className="underline text-zinc-700 disabled:text-zinc-400"
                                disabled={!selectedRole?.id}
                                onClick={() => {
                                  const next = new Set(selectedPermissionKeys);
                                  for (const k of Array.isArray(g.allKeys) ? g.allKeys : []) next.delete(k);
                                  setSelectedPermissionKeys(Array.from(next));
                                }}
                              >
                                {t('clearSelection')}
                              </button>
                            </div>
                          </div>
                          <div className="divide-y divide-zinc-100">
                            {g.items.map((p) => (
                              <label key={p.id} className="flex items-start gap-2 px-4 py-3">
                                <input
                                  type="checkbox"
                                  disabled={!selectedRole?.id}
                                  checked={selectedPermissionKeys.includes(p.key)}
                                  onChange={(e) => {
                                    const next = new Set(selectedPermissionKeys);
                                    if (e.target.checked) next.add(p.key);
                                    else next.delete(p.key);
                                    setSelectedPermissionKeys(Array.from(next));
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-zinc-900">{p.description || p.key}</div>
                                  <div className="mt-0.5 text-[11px] text-zinc-500">{p.key}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })
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
