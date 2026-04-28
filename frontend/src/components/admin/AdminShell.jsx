import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import LanguageSwitcher from '../LanguageSwitcher';

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm transition ${
          isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function AdminShell() {
  const navigate = useNavigate();
  const { t } = useT();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, mode, orgCode, setOrgCode, logout } = useAdminAuthStore((s) => ({
    user: s.user,
    mode: s.mode,
    orgCode: s.orgCode,
    setOrgCode: s.setOrgCode,
    logout: s.logout
  }));

  const role = user?.role || 'admin';
  const canSeeUsers = role === 'super_admin';

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="ac-btn ac-btn-soft px-3 py-2 text-xs md:hidden"
            >
              {mobileNavOpen ? 'Close' : 'Menu'}
            </button>
            <Link to="/admin/dashboard" className="text-sm font-semibold tracking-tight text-zinc-900">
              {t('adminPanel')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <LanguageSwitcher size="xs" />
            <span className={`ac-badge ${mode === 'mock' ? 'ac-badge-mock' : 'ac-badge-backend'}`}>
              {mode === 'mock' ? t('modeDemo') : t('modeServer')}
            </span>
            <div className="text-right">
              <div className="text-xs font-medium text-zinc-900">{user?.name || 'Admin'}</div>
              <div className="text-[11px] text-zinc-500">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/admin/login');
              }}
              className="ac-btn ac-btn-soft px-3 py-2 text-xs"
            >
              {t('signOut')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className={`ac-card p-3 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-auto ${mobileNavOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="mb-3 px-3 text-xs font-semibold text-zinc-500">Admin</div>
            <nav className="space-y-1">
              <NavItem to="/admin/dashboard" label={t('dashboard')} />
              <NavItem to="/admin/records" label={t('records')} />
              <NavItem to="/admin/cms" label={t('cmsBuilder')} />
              <NavItem to="/admin/cert-templates" label={t('certTemplates')} />
              <NavItem to="/admin/analytics" label={t('analytics')} />
              <NavItem to="/admin/audit" label={t('auditLog')} />
              {canSeeUsers ? <NavItem to="/admin/users" label={t('usersRoles')} /> : null}
            </nav>

            <div className="mt-4 rounded-lg bg-zinc-50 p-3">
              <div className="text-[11px] font-semibold text-zinc-500">{t('orgCode')}</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">{t('orgCodeHint')}</div>
            </div>
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
              {t('publicVerifyPage')}:
              <div className="mt-2">
                <Link className="text-zinc-900 underline" to="/verify/BN-TEST-123">
                  /verify/BN-TEST-123
                </Link>
              </div>
            </div>
          </aside>

          <main className="ac-card min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
