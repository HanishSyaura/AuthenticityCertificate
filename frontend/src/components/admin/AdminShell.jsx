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
          isActive ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'text-zinc-700 hover:bg-zinc-50'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function NavSection({ title, children }) {
  return (
    <div className="mt-3">
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function AdminShell() {
  const navigate = useNavigate();
  const { t } = useT();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, logout } = useAdminAuthStore((s) => ({
    user: s.user,
    logout: s.logout
  }));

  const role = user?.role || 'admin';
  const canSeeUsers = role === 'super_admin';

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-[90vw] max-w-none px-4 py-6 sm:px-6 lg:px-8">
        <div className="ac-topbar mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="ac-btn ac-btn-soft px-3 py-2 text-xs md:hidden"
            >
              {mobileNavOpen ? t('close') : t('menu')}
            </button>
            <Link to="/admin/dashboard" className="text-sm font-semibold tracking-tight text-zinc-900 hover:text-brand-800 no-underline hover:no-underline">
              {t('adminPanel')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <LanguageSwitcher size="xs" />
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
          <aside className={`ac-sidenav lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-auto ${mobileNavOpen ? 'block' : 'hidden'} lg:block`}>
            <NavSection title={t('navOverview')}>
              <NavItem to="/admin/dashboard" label={t('dashboard')} />
              <NavItem to="/admin/guide" label={t('gettingStarted')} />
            </NavSection>

            <NavSection title={t('navProductsBatches')}>
              <NavItem to="/admin/records" label={t('records')} />
              <NavItem to="/admin/epc" label={t('epc')} />
            </NavSection>

            <NavSection title={t('navCertificates')}>
              <NavItem to="/admin/certificates" label={t('certificates')} />
              <NavItem to="/admin/identities" label={t('identities')} />
              <NavItem to="/admin/cert-templates" label={t('certTemplates')} />
            </NavSection>

            <NavSection title={t('navContent')}>
              <NavItem to="/admin/cms" label={t('cmsBuilder')} />
            </NavSection>

            <NavSection title={t('navMonitoring')}>
              <NavItem to="/admin/analytics" label={t('analytics')} />
              <NavItem to="/admin/fraud" label={t('fraudDetection')} />
            </NavSection>

            <NavSection title={t('navGovernance')}>
              <NavItem to="/admin/audit" label={t('auditLog')} />
              {canSeeUsers ? <NavItem to="/admin/users" label={t('usersRoles')} /> : null}
            </NavSection>

            <NavSection title={t('navIntegrations')}>
              <NavItem to="/admin/integrations" label={t('integrations')} />
            </NavSection>
          </aside>

          <main className="ac-card min-w-0 bg-white/80 backdrop-blur">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
