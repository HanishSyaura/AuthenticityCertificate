import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAdminSettingsStore from '../../store/useAdminSettingsStore';
import { useT } from '../../i18n/useT';
import LanguageSwitcher from '../LanguageSwitcher';
import TourOverlay from '../tour/TourOverlay';
import useTourStore from '../../store/useTourStore';
import { getAdminGettingStartedTourSteps } from '../../tour/adminGettingStartedTour';
import { hasPermission } from '../../utils/permissions';
import { resolvePublicMediaUrl } from '../../utils/apiBase';
import useResolvedBranding from '../../hooks/useResolvedBranding';

function NavIcon({ name, active }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  const cls = active ? 'text-white' : 'text-white/76';

  if (name === 'dashboard') {
    return (
      <svg {...common} className={cls}>
        <path d="M4 13.5 12 5l8 8" />
        <path d="M6.5 11.5V20h11V11.5" />
      </svg>
    );
  }
  if (name === 'records') {
    return (
      <svg {...common} className={cls}>
        <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
        <path d="M8.5 9h7M8.5 13h7M8.5 17h4.5" />
      </svg>
    );
  }
  if (name === 'epc') {
    return (
      <svg {...common} className={cls}>
        <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
        <rect x="5" y="7" width="14" height="12" rx="2.5" />
        <path d="M9 11h6M9 15h6" />
      </svg>
    );
  }
  if (name === 'certificates') {
    return (
      <svg {...common} className={cls}>
        <rect x="4" y="6" width="16" height="12" rx="2.5" />
        <path d="M8 10h8M8 14h5" />
      </svg>
    );
  }
  if (name === 'cms') {
    return (
      <svg {...common} className={cls}>
        <rect x="4" y="5" width="16" height="14" rx="2.5" />
        <path d="M4 10.5h16M9 19V10.5" />
      </svg>
    );
  }
  if (name === 'settings') {
    return (
      <svg {...common} className={cls}>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="M19 12a7.9 7.9 0 0 0-.09-1.16l2.02-1.57-2-3.46-2.43.72a7.88 7.88 0 0 0-2-.93L14 3h-4l-.5 2.6a7.88 7.88 0 0 0-2 .93l-2.43-.72-2 3.46 2.02 1.57A7.9 7.9 0 0 0 5 12c0 .4.03.78.09 1.16l-2.02 1.57 2 3.46 2.43-.72c.6.4 1.28.71 2 .93L10 21h4l.5-2.6c.72-.22 1.4-.53 2-.93l2.43.72 2-3.46-2.02-1.57c.06-.38.09-.76.09-1.16Z" />
      </svg>
    );
  }
  if (name === 'users') {
    return (
      <svg {...common} className={cls}>
        <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M3.5 18.5A4.5 4.5 0 0 1 8 14h1a4.5 4.5 0 0 1 4.5 4.5M14.5 18.5a3.5 3.5 0 0 1 6 0" />
      </svg>
    );
  }

  return (
    <svg {...common} className={cls}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function NavItem({ to, label, icon, tourId, collapsed }) {
  return (
    <NavLink
      to={to}
      data-tour={tourId}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        collapsed
          ? `flex h-12 items-center justify-center rounded-2xl border text-sm transition ${
              isActive
                ? 'border-white/34 bg-white/16 !text-white shadow-[0_12px_24px_rgba(8,47,73,0.25)]'
                : 'border-transparent !text-white/80 hover:border-white/12 hover:bg-white/10 hover:!text-white'
            }`
          : `group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-[13px] font-semibold transition ${
              isActive
                ? 'border-white/34 bg-white/16 !text-white shadow-[0_14px_28px_rgba(8,47,73,0.24)]'
                : 'border-transparent !text-white/80 hover:border-white/12 hover:bg-white/10 hover:!text-white'
            }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              isActive ? 'border-white/22 bg-white/14' : 'border-white/10 bg-white/8'
            }`}
          >
            <NavIcon name={icon} active={isActive} />
          </div>
          {collapsed ? null : <span className="min-w-0 truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function NavSection({ title, children, collapsed }) {
  return (
    <div className="mt-5 first:mt-0">
      {collapsed ? null : (
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">{title}</div>
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ac_admin_sidebar_collapsed_v1') === '1';
    } catch {
      return false;
    }
  });
  const [logoErrored, setLogoErrored] = useState(false);
  const profileMenuRef = useRef(null);
  const profileMenuPanelRef = useRef(null);
  const [profileMenuPos, setProfileMenuPos] = useState({ top: 0, left: 0 });
  const { openTour, setNavigator } = useTourStore((s) => ({ openTour: s.openTour, setNavigator: s.setNavigator }));
  const { token, user, logout } = useAdminAuthStore((s) => ({
    token: s.token,
    user: s.user,
    logout: s.logout
  }));
  const { organization, settings, fetchSettings } = useAdminSettingsStore((s) => ({
    organization: s.organization,
    settings: s.settings,
    fetchSettings: s.fetchSettings
  }));
  const branding = useResolvedBranding();

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

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event) => {
      if (profileMenuRef.current?.contains(event.target)) return;
      if (profileMenuPanelRef.current?.contains(event.target)) return;
      setProfileMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };

    const handleWindow = () => {
      const trigger = profileMenuRef.current;
      const panel = profileMenuPanelRef.current;
      if (!trigger || !panel) return;
      const rect = trigger.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || 240;
      const panelHeight = panel.offsetHeight || 0;
      const margin = 12;
      const maxLeft = window.innerWidth - margin - panelWidth;
      const left = Math.max(margin, Math.min(rect.right - panelWidth, maxLeft));
      const bottomTop = rect.bottom + 8;
      const topTop = rect.top - 8 - panelHeight;
      const canOpenBottom = bottomTop + panelHeight <= window.innerHeight - margin;
      const maxTop = Math.max(margin, window.innerHeight - margin - panelHeight);
      const top = Math.max(margin, Math.min(canOpenBottom ? bottomTop : topTop, maxTop));
      setProfileMenuPos({ top, left });
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleWindow);
    window.addEventListener('scroll', handleWindow, true);
    handleWindow();

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleWindow);
      window.removeEventListener('scroll', handleWindow, true);
    };
  }, [profileMenuOpen]);

  useLayoutEffect(() => {
    if (!profileMenuOpen) return;
    const trigger = profileMenuRef.current;
    const panel = profileMenuPanelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 240;
    const panelHeight = panel.offsetHeight || 0;
    const margin = 12;
    const maxLeft = window.innerWidth - margin - panelWidth;
    const left = Math.max(margin, Math.min(rect.right - panelWidth, maxLeft));
    const bottomTop = rect.bottom + 8;
    const topTop = rect.top - 8 - panelHeight;
    const canOpenBottom = bottomTop + panelHeight <= window.innerHeight - margin;
    const maxTop = Math.max(margin, window.innerHeight - margin - panelHeight);
    const top = Math.max(margin, Math.min(canOpenBottom ? bottomTop : topTop, maxTop));
    setProfileMenuPos({ top, left });
  }, [profileMenuOpen]);

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
    hasPermission(perms, 'epc.production.access') ||
    hasPermission(perms, 'epc.batch_import.access') ||
    hasPermission(perms, 'epc.export.xlsx') ||
    hasPermission(perms, 'epc.encoding') ||
    hasPermission(perms, 'epc.sequence.reset') ||
    hasPermission(perms, 'epc.delete') ||
    hasPermission(perms, 'epc.override') ||
    hasPermission(perms, 'epc.certificate.view');

  const brandTitle = branding.organizationName;
  const brandSubtitle = branding.appTitle;

  return (
    <div className="ac-admin-app h-[100dvh] overflow-hidden bg-[#edf3f8]">
      <div className="relative flex h-full flex-col overflow-hidden">
        <header
          className="relative z-20 border-b border-[#d8e4ee] px-4 py-3 text-white shadow-[0_10px_30px_rgba(8,47,73,0.10)]"
          style={{ background: 'linear-gradient(180deg, rgba(var(--ac-brand-rgb), 0.98) 0%, rgba(var(--ac-brand-deep-rgb), 0.98) 100%)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                className="rounded-2xl border border-white/16 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/14 md:hidden"
              >
                {mobileNavOpen ? t('close') : t('menu')}
              </button>
              <Link to="/admin/dashboard" className="flex min-w-0 items-center gap-3 text-white no-underline hover:no-underline">
                {branding.logoUrl && !logoErrored ? (
                  <img
                    src={resolvePublicMediaUrl(branding.logoUrl)}
                    alt="Brand logo"
                    className="h-11 w-auto max-w-[120px] shrink-0 object-contain"
                    onError={() => setLogoErrored(true)}
                  />
                ) : (
                  <div className="shrink-0 text-sm font-black tracking-[0.22em] text-white">
                    ZP
                  </div>
                )}
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[15px] font-semibold tracking-tight text-white">{brandTitle}</div>
                  <div className="truncate text-[12px] font-medium text-white/72">{brandSubtitle}</div>
                </div>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                data-tour="nav-guide"
                className="inline-flex items-center rounded-full border border-white/18 bg-white/12 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/16"
                onClick={() => openTour({ steps: getAdminGettingStartedTourSteps(t), storageKey: 'ac_seen_admin_tour_v1' })}
              >
                {t('gettingStarted')}
              </button>
              <LanguageSwitcher size="xs" />
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  className="flex items-center gap-3 rounded-[20px] border border-white/16 bg-white/12 px-3 py-2 text-left backdrop-blur transition hover:bg-white/16"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/16 bg-white/12 text-sm font-semibold text-white">
                    {(user?.name || 'A').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden min-w-0 leading-tight sm:block">
                    <div className="truncate text-sm font-semibold text-white">{user?.name || t('adminUserFallback')}</div>
                    <div className="truncate text-xs text-white/72">{user?.email}</div>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className={`text-white/80 transition ${profileMenuOpen ? 'rotate-180' : ''}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {profileMenuOpen && typeof document !== 'undefined'
                  ? createPortal(
                      <div
                        ref={profileMenuPanelRef}
                        style={{ position: 'fixed', top: profileMenuPos.top, left: profileMenuPos.left }}
                        className="z-40 w-[240px] rounded-[24px] border border-[#d7e3ec] bg-white p-2 shadow-[0_24px_48px_rgba(15,23,42,0.16)]"
                      >
                        <div className="rounded-[18px] bg-slate-50 px-3 py-3">
                          <div className="text-sm font-semibold text-slate-950">{user?.name || t('adminUserFallback')}</div>
                          <div className="mt-1 break-all text-xs text-slate-500">{user?.email}</div>
                        </div>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            logout();
                            navigate('/admin/login');
                          }}
                          className="mt-2 flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <span>{t('signOut')}</span>
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M7.5 5.5h-2A1.5 1.5 0 0 0 4 7v6a1.5 1.5 0 0 0 1.5 1.5h2" />
                            <path d="M11 14.5 15 10l-4-4.5" />
                            <path d="M15 10H8" />
                          </svg>
                        </button>
                      </div>,
                      document.body
                    )
                  : null}
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside
            className={`${sidebarCollapsed ? 'w-[96px]' : 'w-[264px]'} relative h-full flex-shrink-0 ${
              mobileNavOpen ? 'block' : 'hidden'
            } md:block`}
          >
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-pressed={sidebarCollapsed}
              aria-label={sidebarCollapsed ? t('expand') : t('collapse')}
              className="absolute right-[-14px] top-5 z-20 hidden h-9 w-9 items-center justify-center rounded-full border border-[#d4e2ec] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] transition hover:bg-[#f7fbfe] md:flex"
              style={{ color: 'var(--ac-brand)' }}
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
            <div className="absolute inset-y-0 right-0 hidden w-px bg-white/10 md:block" />
            <div
              className="flex h-full flex-col overflow-hidden pt-4 text-white shadow-[22px_0_44px_rgba(8,47,73,0.12)]"
              style={{ background: 'linear-gradient(180deg, var(--ac-brand) 0%, var(--ac-brand-mid) 22%, var(--ac-brand-deep) 100%)' }}
            >
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <NavSection title={t('navOverview')} collapsed={sidebarCollapsed}>
                  <NavItem to="/admin/dashboard" label={t('dashboard')} icon="dashboard" tourId="nav-dashboard" collapsed={sidebarCollapsed} />
                </NavSection>

                <NavSection title={t('navProductsBatches')} collapsed={sidebarCollapsed}>
                  <NavItem to="/admin/records" label={t('productModule')} icon="records" tourId="nav-records" collapsed={sidebarCollapsed} />
                  {canSeeEpc ? <NavItem to="/admin/epc" label={t('epcManagement')} icon="epc" tourId="nav-epc" collapsed={sidebarCollapsed} /> : null}
                </NavSection>

                <NavSection title={t('navCertificates')} collapsed={sidebarCollapsed}>
                  <NavItem
                    to="/admin/certificates"
                    label={t('certificateList')}
                    icon="certificates"
                    tourId="nav-certificates"
                    collapsed={sidebarCollapsed}
                  />
                </NavSection>

                <NavSection title={t('navContent')} collapsed={sidebarCollapsed}>
                  <NavItem to="/admin/cms" label={t('cmsLanding')} icon="cms" tourId="nav-cms" collapsed={sidebarCollapsed} />
                </NavSection>

                <NavSection title={t('navSettings')} collapsed={sidebarCollapsed}>
                  <NavItem to="/admin/settings" label={t('settings')} icon="settings" tourId="nav-settings" collapsed={sidebarCollapsed} />
                  {canSeeUsers ? <NavItem to="/admin/users" label={t('usersRoles')} icon="users" collapsed={sidebarCollapsed} /> : null}
                </NavSection>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-y-0 right-[-9%] w-[58%] rounded-full bg-[radial-gradient(circle,rgba(10,132,177,0.10)_0%,rgba(10,132,177,0.03)_44%,transparent_68%)] blur-[2px]" />
                <div className="absolute right-[12%] top-[88px] h-[480px] w-[480px] rounded-full border border-white/55 bg-white/22 blur-[1px]" />
                <div className="absolute right-[20%] top-[150px] h-[360px] w-[360px] rounded-full border border-[#91cee1]/45" />
                <div className="absolute left-[6%] top-0 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.12)_0%,transparent_70%)]" />
              </div>

              <main className="relative flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
                <div className="relative min-w-0 rounded-[30px] border border-white/80 bg-white/76 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[30px] backdrop-blur" />
                  <div className="relative">
                    <Outlet />
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
      <TourOverlay />
    </div>
  );
}
