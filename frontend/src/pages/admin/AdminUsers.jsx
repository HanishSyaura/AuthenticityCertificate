import React, { useEffect, useMemo, useState } from 'react';
import useUsersStore from '../../store/useUsersStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default function AdminUsers() {
  const { t } = useT();
  const authUser = useAdminAuthStore((s) => s.user);
  const role = authUser?.role || 'admin';
  const canManage = role === 'super_admin';

  const { users, loading, error, lastSyncAt, fetchUsers, createUser, updateUserRole, deleteUser } = useUsersStore((s) => ({
    users: s.users,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchUsers: s.fetchUsers,
    createUser: s.createUser,
    updateUserRole: s.updateUserRole,
    deleteUser: s.deleteUser
  }));

  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState('admin');

  useEffect(() => {
    if (canManage) void fetchUsers();
  }, [canManage, fetchUsers]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const n = String(u?.name || '').toLowerCase();
      const e = String(u?.email || '').toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [users, query]);

  if (!canManage) {
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('usersRoles')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('usersSubtitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchUsers()}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
        <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => setShowCreate(true)}>
          {t('createUser')}
        </button>
      </div>

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchUsers')}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        />
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[2fr_1fr_1fr_120px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
              <div>{t('user')}</div>
              <div>{t('role')}</div>
              <div>{t('status')}</div>
              <div className="text-right">{t('actions')}</div>
            </div>
            {loading ? (
              <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm font-semibold text-zinc-900">{t('noUsers')}</div>
                <div className="mt-1 text-xs text-zinc-600">{t('noUsersHint')}</div>
              </div>
            ) : (
              filtered.map((u) => {
                const disabled = Boolean(u.deletedAt) || String(u.email) === String(authUser?.email);
                return (
                  <div
                    key={u.id}
                    className="grid grid-cols-[2fr_1fr_1fr_120px] gap-4 border-b border-zinc-100 px-4 py-3 text-sm text-zinc-800 last:border-b-0"
                  >
                    <div>
                      <div className="font-medium text-zinc-900">{u.name}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-500">{u.email}</div>
                    </div>
                    <div>
                      <select
                        value={u.role}
                        disabled={disabled}
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
                    </div>
                    <div className="text-xs text-zinc-700">
                      {u.deletedAt ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5">{t('inactive')}</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{t('active')}</span>
                      )}
                      <div className="mt-1 text-[11px] text-zinc-500">{formatDate(u.updatedAt || u.createdAt)}</div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        disabled={disabled}
                        onClick={async () => {
                          if (!window.confirm(t('confirmDeleteUser'))) return;
                          await deleteUser({ id: u.id });
                        }}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}
