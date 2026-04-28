import React from 'react';
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
  const { user, mode, logout } = useAdminAuthStore((s) => ({
    user: s.user,
    mode: s.mode,
    logout: s.logout
  }));

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/admin/dashboard" className="text-sm font-semibold tracking-tight text-zinc-900">
            {t('adminPanel')}
          </Link>
          <div className="flex items-center gap-3">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
          <aside className="ac-card p-3">
            <div className="mb-3 px-3 text-xs font-semibold text-zinc-500">Admin</div>
            <nav className="space-y-1">
              <NavItem to="/admin/dashboard" label={t('dashboard')} />
              <NavItem to="/admin/cms" label={t('cmsBuilder')} />
              <NavItem to="/admin/cert-templates" label={t('certTemplates')} />
              <NavItem to="/admin/analytics" label={t('analytics')} />
            </nav>
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
              {t('publicVerifyPage')}:
              <div className="mt-2">
                <Link className="text-zinc-900 underline" to="/verify/BN-TEST-123">
                  /verify/BN-TEST-123
                </Link>
              </div>
            </div>
          </aside>

          <main className="ac-card">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
