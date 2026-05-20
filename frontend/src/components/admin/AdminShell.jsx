import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAdminSettingsStore from '../../store/useAdminSettingsStore';
import { useT } from '../../i18n/useT';
import LanguageSwitcher from '../LanguageSwitcher';
import TourOverlay from '../tour/TourOverlay';
import useTourStore from '../../store/useTourStore';
import { getAdminGettingStartedTourSteps } from '../../tour/adminGettingStartedTour';
import { hasPermission } from '../../utils/permissions';

function NavItem({ to, label, tourId, collapsed }) {
  const shortLabel = (label || '').trim();
  const initial = shortLabel ? shortLabel[0].toUpperCase() : '?';
  return (
    <NavLink
      to={to}
      data-tour={tourId}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        collapsed
          ? `flex items-center justify-center rounded py-2 text-sm transition ${
              isActive ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800/60 hover:text-white'
            }`
          : `block rounded px-3 py-2 text-sm transition ${
              isActive ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800/60 hover:text-white'
            }`
      }
    >
      {collapsed ? (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-xs font-semibold tracking-wide">
          {initial}
        </div>
      ) : (
        label
      )}
    </NavLink>
  );
}

function NavSection({ title, children, collapsed }) {
  return (
    <div className="mt-3">
      {collapsed ? null : (
        <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ac_admin_sidebar_collapsed_v1') === '1';
    } catch {
      return false;
    }
  });
  const { openTour, setNavigator } = useTourStore((s) => ({ openTour: s.openTour, setNavigator: s.setNavigator }));
  const { token, user, logout } = useAdminAuthStore((s) => ({
    token: s.token,
    user: s.user,
    logout: s.logout
  }));
  const { settings, fetchSettings } = useAdminSettingsStore((s) => ({ settings: s.settings, fetchSettings: s.fetchSettings }));

  useEffect(() => {
    if (!token) return;
    if (settings) return;
    fetchSettings();
  }, [token, settings, fetchSettings]);

  useEffect(() => {
    setNavigator(navigate);
  }, [navigate, setNavigator]);

  useEffect(() => {
    if (!token) return;
    if (!user?.mustResetPassword) return;
    if (location.pathname === '/admin/force-reset') return;
    navigate('/admin/force-reset', { replace: true });
  }, [location.pathname, navigate, token, user?.mustResetPassword]);

  useEffect(() => {
    try {
      localStorage.setItem('ac_admin_sidebar_collapsed_v1', sidebarCollapsed ? '1' : '0');
    } catch {
      void 0;
    }
  }, [sidebarCollapsed]);

  const role = user?.role || 'admin';
  const perms = user?.permissions || [];
  const canSeeUsers = role === 'super_admin' || hasPermission(perms, 'users.manage') || hasPermission(perms, 'access.manage');
  const canSeeEpc =
    role === 'super_admin' ||
    hasPermission(perms, '*') ||
    hasPermission(perms, 'epc.read') ||
    hasPermission(perms, 'epc.write') ||
    hasPermission(perms, 'epc.batch.view') ||
    hasPermission(perms, 'epc.batch.create') ||
    hasPermission(perms, 'epc.scan.access') ||
    hasPermission(perms, 'epc.production.access') ||
    hasPermission(perms, 'epc.export.xlsx') ||
    hasPermission(perms, 'epc.encoding') ||
    hasPermission(perms, 'epc.sequence.reset') ||
    hasPermission(perms, 'epc.delete') ||
    hasPermission(perms, 'epc.override') ||
    hasPermission(perms, 'epc.certificate.view');

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="flex min-h-screen">
        <aside
          className={`${sidebarCollapsed ? 'w-[64px]' : 'w-[260px]'} flex-shrink-0 bg-slate-900 text-slate-200 ${
            mobileNavOpen ? 'block' : 'hidden'
          } md:block`}
        >
          <div className={`flex h-14 items-center gap-2 border-b border-slate-800 ${sidebarCollapsed ? 'px-3' : 'px-4'}`}>
            {settings?.logoUrl ? (
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-white/10">
                <img src={settings.logoUrl} alt="Brand logo" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded bg-orange-500" />
            )}
            {sidebarCollapsed ? null : (
              <div className="text-sm font-semibold tracking-tight text-white">Certificate Authenticity</div>
            )}
          </div>

          <div className={`h-[calc(100vh-3.5rem)] overflow-auto ${sidebarCollapsed ? 'px-2' : 'px-2'} py-3`}>
            <NavSection title={t('navOverview')} collapsed={sidebarCollapsed}>
              <NavItem to="/admin/dashboard" label={t('dashboard')} tourId="nav-dashboard" collapsed={sidebarCollapsed} />
            </NavSection>

            <NavSection title={t('navProductsBatches')} collapsed={sidebarCollapsed}>
              <NavItem to="/admin/records" label={t('productModule')} tourId="nav-records" collapsed={sidebarCollapsed} />
              {canSeeEpc ? <NavItem to="/admin/epc" label={t('epc')} tourId="nav-epc" collapsed={sidebarCollapsed} /> : null}
            </NavSection>

            <NavSection title={t('navCertificates')} collapsed={sidebarCollapsed}>
              <NavItem
                to="/admin/certificates"
                label={t('certificateList')}
                tourId="nav-certificates"
                collapsed={sidebarCollapsed}
              />
            </NavSection>

            <NavSection title={t('navContent')} collapsed={sidebarCollapsed}>
              <NavItem to="/admin/cms" label={t('cmsLanding')} tourId="nav-cms" collapsed={sidebarCollapsed} />
            </NavSection>

            <NavSection title={t('navSettings')} collapsed={sidebarCollapsed}>
              <NavItem to="/admin/settings" label={t('settings')} tourId="nav-settings" collapsed={sidebarCollapsed} />
              {canSeeUsers ? <NavItem to="/admin/users" label={t('usersRoles')} collapsed={sidebarCollapsed} /> : null}
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
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-pressed={sidebarCollapsed}
                className="hidden items-center justify-center rounded border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 md:inline-flex"
                title={sidebarCollapsed ? t('expand') : t('collapse')}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  {sidebarCollapsed ? (
                    <path
                      fillRule="evenodd"
                      d="M7.22 3.22a.75.75 0 0 1 1.06 0l6 6a.75.75 0 0 1 0 1.06l-6 6a.75.75 0 1 1-1.06-1.06L12.69 10 7.22 4.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M12.78 3.22a.75.75 0 0 1 0 1.06L7.31 10l5.47 5.72a.75.75 0 0 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
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
                <div className="text-sm font-medium text-zinc-900">{user?.name || t('adminUserFallback')}</div>
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
