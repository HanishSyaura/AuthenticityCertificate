import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import LanguageSwitcher from '../LanguageSwitcher';
import TourOverlay from '../tour/TourOverlay';
import useTourStore from '../../store/useTourStore';
import { getAdminGettingStartedTourSteps } from '../../tour/adminGettingStartedTour';
import { hasPermission } from '../../utils/permissions';

function NavItem({ to, label, tourId }) {
  return (
    <NavLink
      to={to}
      data-tour={tourId}
      className={({ isActive }) =>
        `block rounded px-3 py-2 text-sm transition ${
          isActive ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800/60 hover:text-white'
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
      <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function AdminShell() {
  const navigate = useNavigate();
  const { t } = useT();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { openTour } = useTourStore((s) => ({ openTour: s.openTour }));
  const { user, logout } = useAdminAuthStore((s) => ({
    user: s.user,
    logout: s.logout
  }));

  const role = user?.role || 'admin';
  const perms = user?.permissions || [];
  const canSeeUsers = role === 'super_admin' || hasPermission(perms, 'users.manage') || hasPermission(perms, 'access.manage');

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="flex min-h-screen">
        <aside className={`w-[260px] flex-shrink-0 bg-slate-900 text-slate-200 ${mobileNavOpen ? 'block' : 'hidden'} md:block`}>
          <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4">
            <div className="h-7 w-7 rounded bg-orange-500" />
            <div className="text-sm font-semibold tracking-tight text-white">WMS Console</div>
          </div>

          <div className="h-[calc(100vh-3.5rem)] overflow-auto px-2 py-3">
            <NavSection title={t('navOverview')}>
              <NavItem to="/admin/dashboard" label={t('dashboard')} tourId="nav-dashboard" />
            </NavSection>

            <NavSection title={t('navProductsBatches')}>
              <NavItem to="/admin/records" label={t('productModule')} tourId="nav-records" />
              <NavItem to="/admin/epc" label={t('epc')} tourId="nav-epc" />
            </NavSection>

            <NavSection title={t('navCertificates')}>
              <NavItem to="/admin/certificates" label={t('certificateList')} tourId="nav-certificates" />
            </NavSection>

            <NavSection title={t('navContent')}>
              <NavItem to="/admin/cms" label={t('cmsLanding')} tourId="nav-cms" />
            </NavSection>

            <NavSection title={t('navSettings')}>
              <NavItem to="/admin/settings" label={t('settings')} tourId="nav-settings" />
              {canSeeUsers ? <NavItem to="/admin/users" label={t('usersRoles')} /> : null}
            </NavSection>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 md:hidden"
              >
                {mobileNavOpen ? t('close') : t('menu')}
              </button>
              <Link to="/admin/dashboard" className="text-sm font-semibold text-zinc-900 no-underline hover:no-underline">
                {t('adminPanel')}
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                data-tour="nav-guide"
                className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => openTour({ steps: getAdminGettingStartedTourSteps(t), storageKey: 'ac_seen_admin_tour_v1' })}
              >
                {t('gettingStarted')}
              </button>
              <LanguageSwitcher size="xs" />
              <div className="text-right">
                <div className="text-sm font-medium text-zinc-900">{user?.name || 'Admin'}</div>
                <div className="text-xs text-zinc-500">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/admin/login');
                }}
                className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {t('signOut')}
              </button>
            </div>
          </div>

          <main className="p-4">
            <div className="min-w-0 rounded border border-zinc-200 bg-white">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <TourOverlay />
    </div>
  );
}
