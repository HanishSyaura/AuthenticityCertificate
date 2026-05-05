import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAdminSettingsStore from '../../store/useAdminSettingsStore';
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

  const role = user?.role || 'admin';
  const perms = user?.permissions || [];
  const canSeeUsers = role === 'super_admin' || hasPermission(perms, 'users.manage') || hasPermission(perms, 'access.manage');
  const canSeeProducts = role === 'super_admin' || hasPermission(perms, 'products.read') || hasPermission(perms, 'products.write');
  const canSeeEpc = role === 'super_admin' || hasPermission(perms, 'epc.read') || hasPermission(perms, 'epc.write');
  const canSeeCertificates =
    role === 'super_admin' ||
    hasPermission(perms, 'certificates.read') ||
    hasPermission(perms, 'certificates.write') ||
    hasPermission(perms, 'templates.read') ||
    hasPermission(perms, 'templates.write');
  const canSeeCms =
    role === 'super_admin' || hasPermission(perms, 'cms.read') || hasPermission(perms, 'cms.write') || hasPermission(perms, 'cms.publish');
  const canSeeAnalytics = role === 'super_admin' || hasPermission(perms, 'analytics.read');
  const canSeeFraud = role === 'super_admin' || hasPermission(perms, 'fraud.read') || hasPermission(perms, 'fraud.write');
  const canSeeAudit = role === 'super_admin' || hasPermission(perms, 'audit.read');
  const canSeeIntegrations = role === 'super_admin' || hasPermission(perms, 'integrations.read') || hasPermission(perms, 'integrations.write');
  const canSeeMedia = role === 'super_admin' || hasPermission(perms, 'media.read') || hasPermission(perms, 'media.write');
  const canSeeBulk = role === 'super_admin' || hasPermission(perms, 'bulk.read') || hasPermission(perms, 'bulk.write');
  const canSeeIdentities = role === 'super_admin' || hasPermission(perms, 'identities.read') || hasPermission(perms, 'identities.write');
  const canSeeSettings = role === 'super_admin' || hasPermission(perms, 'settings.read') || hasPermission(perms, 'settings.write');

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="flex min-h-screen">
        <aside className={`w-[260px] flex-shrink-0 bg-slate-900 text-slate-200 ${mobileNavOpen ? 'block' : 'hidden'} md:block`}>
          <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4">
            {settings?.logoUrl ? (
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-white/10">
                <img src={settings.logoUrl} alt="Brand logo" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-7 w-7 rounded bg-orange-500" />
            )}
            <div className="text-sm font-semibold tracking-tight text-white">Certificate Authenticity</div>
          </div>

          <div className="h-[calc(100vh-3.5rem)] overflow-auto px-2 py-3">
            <NavSection title={t('navOverview')}>
              <NavItem to="/admin/dashboard" label={t('dashboard')} tourId="nav-dashboard" />
            </NavSection>

            {canSeeProducts || canSeeEpc ? (
              <NavSection title={t('navProductsBatches')}>
                {canSeeProducts ? <NavItem to="/admin/records" label={t('productModule')} tourId="nav-records" /> : null}
                {canSeeEpc ? <NavItem to="/admin/epc" label={t('epc')} tourId="nav-epc" /> : null}
              </NavSection>
            ) : null}

            {canSeeCertificates || canSeeIdentities ? (
              <NavSection title={t('navCertificates')}>
                {canSeeCertificates ? <NavItem to="/admin/certificates" label={t('certificateList')} tourId="nav-certificates" /> : null}
                {canSeeIdentities ? <NavItem to="/admin/identities" label={t('identities')} /> : null}
              </NavSection>
            ) : null}

            {canSeeCms ? (
              <NavSection title={t('navContent')}>
                <NavItem to="/admin/cms" label={t('cmsLanding')} tourId="nav-cms" />
              </NavSection>
            ) : null}

            {canSeeAnalytics || canSeeFraud || canSeeAudit ? (
              <NavSection title={t('navMonitoring')}>
                {canSeeAnalytics ? <NavItem to="/admin/analytics" label={t('analytics')} /> : null}
                {canSeeFraud ? <NavItem to="/admin/fraud" label={t('fraudDetection')} /> : null}
                {canSeeAudit ? <NavItem to="/admin/audit" label={t('auditLog')} /> : null}
              </NavSection>
            ) : null}

            {canSeeMedia || canSeeIntegrations || canSeeBulk ? (
              <NavSection title={t('navTools')}>
                {canSeeMedia ? <NavItem to="/admin/media" label={t('media')} /> : null}
                {canSeeIntegrations ? <NavItem to="/admin/integrations" label={t('integrations')} /> : null}
                {canSeeBulk ? <NavItem to="/admin/bulk" label={t('bulk')} /> : null}
              </NavSection>
            ) : null}

            {canSeeSettings || canSeeUsers ? (
              <NavSection title={t('navSettings')}>
                {canSeeSettings ? <NavItem to="/admin/settings" label={t('settings')} tourId="nav-settings" /> : null}
                {canSeeUsers ? <NavItem to="/admin/users" label={t('usersRoles')} /> : null}
              </NavSection>
            ) : null}
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
