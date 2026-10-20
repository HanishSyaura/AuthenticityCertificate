import React, { useEffect, useMemo, useState } from 'react';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import useTourStore from '../../store/useTourStore';
import { getAdminGettingStartedTourSteps } from '../../tour/adminGettingStartedTour';
import { createAdminApi } from '../../utils/adminApi';
import { hasPermission } from '../../utils/permissions';

function SummaryCard({ label, value, hint, tone = 'blue' }) {
  const toneMap = {
    blue: 'border-[#d8e7f0] bg-white',
    amber: 'border-[#efe1c1] bg-[#fffdfa]',
    green: 'border-[#dcebe2] bg-[#fbfefc]'
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-[0_16px_30px_rgba(15,23,42,0.05)] ${toneMap[tone] || toneMap.blue}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm leading-6 text-slate-600">{hint}</div>
      <div className="mt-4 h-1.5 w-12 rounded-full" style={{ background: 'linear-gradient(90deg, var(--ac-brand) 0%, var(--ac-accent) 100%)' }} />
    </div>
  );
}

function MetricCard({ title, value, hint, tone = 'blue', icon }) {
  const toneMap = {
    blue: {
      icon: 'border-[#bfdae6] bg-[#edf7fb] text-[#0b6f97]',
      card: 'border-[#d6e6ef] bg-white'
    },
    amber: {
      icon: 'border-[#ebd7b2] bg-[#fff8eb] text-[#b46b00]',
      card: 'border-[#efe1c1] bg-[#fffdfa]'
    },
    green: {
      icon: 'border-[#cee3d8] bg-[#f0f8f4] text-[#17794d]',
      card: 'border-[#dcebe2] bg-[#fbfefc]'
    },
    slate: {
      icon: 'border-[#d8dee7] bg-[#f4f7fa] text-[#415468]',
      card: 'border-[#dfe6ee] bg-[#fbfcfd]'
    }
  };

  const palette = toneMap[tone] || toneMap.blue;

  return (
    <div className={`rounded-[24px] border p-4 shadow-[0_16px_32px_rgba(15,23,42,0.05)] ${palette.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${palette.icon}`}>{icon}</div>
        <div className="rounded-full bg-slate-950/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
      </div>
      <div className="mt-4 text-[1.9rem] font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1.5 text-sm leading-6 text-slate-600">{hint}</div>
      <div className="mt-4 h-1.5 w-12 rounded-full" style={{ background: 'linear-gradient(90deg, var(--ac-brand) 0%, var(--ac-accent) 100%)' }} />
    </div>
  );
}

function DashboardSection({ label, title, subtitle, action, children, className = '', style = undefined }) {
  return (
    <section
      className={`rounded-[28px] border border-[#d7e3ec] bg-white/96 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur sm:p-5 ${className}`}
      style={style}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          {label ? (
            <div
              className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ borderColor: 'rgba(var(--ac-brand-rgb), 0.18)', background: 'var(--ac-brand-soft)', color: 'var(--ac-brand)' }}
            >
              {label}
            </div>
          ) : null}
          <h3 className={`${label ? 'mt-3' : ''} text-[1.3rem] font-semibold tracking-tight text-slate-950`}>{title}</h3>
          {subtitle ? <p className="mt-1.5 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ActionButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function AdminDashboard() {
  const { t } = useT();
  const [tourAutoStarted, setTourAutoStarted] = useState(false);
  const [latestEpc, setLatestEpc] = useState('');
  const [epcStats, setEpcStats] = useState(null);
  const [dashboardCounts, setDashboardCounts] = useState({ products: null, pages: null, templates: null });
  const { openTour, hasSeen } = useTourStore((s) => ({ openTour: s.openTour, hasSeen: s.hasSeen }));
  const { token, user } = useAdminAuthStore((s) => ({ token: s.token, user: s.user }));

  const role = user?.role || 'admin';
  const perms = useMemo(() => (Array.isArray(user?.permissions) ? user.permissions : []), [user?.permissions]);
  const canReadEpc = useMemo(() => {
    if (role === 'super_admin') return true;
    if (hasPermission(perms, '*')) return true;
    return ['epc.read', 'epc.write', 'epc.batch.view', 'epc.batch.create', 'epc.production.access', 'epc.batch_import.access'].some((k) =>
      hasPermission(perms, k)
    );
  }, [perms, role]);
  const canReadProducts = useMemo(() => {
    if (role === 'super_admin') return true;
    if (hasPermission(perms, '*')) return true;
    return ['products.read', 'products.write', 'categories.read', 'categories.write'].some((k) => hasPermission(perms, k));
  }, [perms, role]);
  const canReadCms = useMemo(() => {
    if (role === 'super_admin') return true;
    if (hasPermission(perms, '*')) return true;
    return ['cms.read', 'cms.write', 'cms.publish', 'cms.meta.write'].some((k) => hasPermission(perms, k));
  }, [perms, role]);
  const canReadTemplates = useMemo(() => {
    if (role === 'super_admin') return true;
    if (hasPermission(perms, '*')) return true;
    return ['templates.read', 'templates.write'].some((k) => hasPermission(perms, k));
  }, [perms, role]);

  useEffect(() => {
    if (!token || !canReadEpc) {
      setLatestEpc('');
      setEpcStats(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const api = createAdminApi({ token });
        const [itemsRes, statsRes] = await Promise.all([
          api.get('/epc/items', { params: { limit: 1, offset: 0 } }),
          api.get('/epc/stats')
        ]);
        const epc = String(itemsRes?.data?.data?.items?.[0]?.epcCode || '').trim();
        if (!alive) return;
        setLatestEpc(epc);
        setEpcStats(statsRes?.data?.data || null);
      } catch {
        if (!alive) return;
        setLatestEpc('');
        setEpcStats(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, canReadEpc]);

  useEffect(() => {
    if (!token || (!canReadProducts && !canReadCms && !canReadTemplates)) {
      setDashboardCounts({ products: null, pages: null, templates: null });
      return;
    }
    let alive = true;
    (async () => {
      try {
        const api = createAdminApi({ token });
        const [productsRes, pagesRes, templatesRes] = await Promise.all([
          canReadProducts ? api.get('/products/') : Promise.resolve(null),
          canReadCms ? api.get('/cms/pages', { params: { kind: 'landing' } }) : Promise.resolve(null),
          canReadTemplates ? api.get('/templates/') : Promise.resolve(null)
        ]);
        if (!alive) return;
        const products = Array.isArray(productsRes?.data?.data) ? productsRes.data.data.length : null;
        const pages = Array.isArray(pagesRes?.data?.data) ? pagesRes.data.data.length : null;
        const templates = Array.isArray(templatesRes?.data?.data) ? templatesRes.data.data.length : null;
        setDashboardCounts({ products, pages, templates });
      } catch {
        if (!alive) return;
        setDashboardCounts({ products: null, pages: null, templates: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, canReadProducts, canReadCms, canReadTemplates]);

  useEffect(() => {
    const storageKey = 'ac_seen_admin_tour_v1';
    if (tourAutoStarted) return;
    if (hasSeen(storageKey)) return;
    setTourAutoStarted(true);
    const timer = setTimeout(() => {
      openTour({ steps: getAdminGettingStartedTourSteps(t), storageKey });
    }, 250);
    return () => clearTimeout(timer);
  }, [tourAutoStarted, hasSeen, openTour, t]);

  const epcGeneratedCount = useMemo(() => (epcStats ? Number(epcStats.generatedCount) || 0 : null), [epcStats]);
  const epcActiveCount = useMemo(() => (epcStats ? Number(epcStats.activeCount) || 0 : null), [epcStats]);
  const epcInactiveCount = useMemo(() => (epcStats ? Number(epcStats.inactiveCount) || 0 : null), [epcStats]);
  const formatMaybeCount = (n) => (typeof n === 'number' ? n.toLocaleString() : '—');
  const verifyPath = useMemo(() => {
    if (latestEpc) return `/verify?epc=${encodeURIComponent(latestEpc)}`;
    return '/verify/<CERTIFICATE_ID>';
  }, [latestEpc]);
  const verifyUrl = useMemo(() => {
    try {
      const origin = typeof window !== 'undefined' ? String(window.location.origin || '') : '';
      return origin ? `${origin}${verifyPath}` : verifyPath;
    } catch {
      return verifyPath;
    }
  }, [verifyPath]);

  const openVerifyUrl = (url) => {
    const u = String(url || '').trim();
    if (!u) return;
    const w = window.open(u, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  };

  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6">
      <section
        className="relative overflow-hidden rounded-[28px] border border-[#d9e4ec] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, var(--ac-bg-soft) 62%, rgba(var(--ac-brand-rgb), 0.06) 100%)' }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-[-10%] w-[45%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(var(--ac-brand-rgb), 0.12) 0%, rgba(var(--ac-brand-rgb), 0.03) 45%, transparent 70%)' }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-[1.9rem] font-semibold tracking-tight text-slate-950 sm:text-[2rem]">{t('dashboard')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t('dashboardSubtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                className="text-white"
                style={{ background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)', boxShadow: '0 16px 30px rgba(var(--ac-brand-rgb), 0.20)' }}
                data-tour="dashboard-start-tour"
                onClick={() => openTour({ steps: getAdminGettingStartedTourSteps(t), storageKey: 'ac_seen_admin_tour_v1' })}
              >
                {t('tourStart')}
              </ActionButton>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.8fr)]">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard label={t('products')} value={canReadProducts ? formatMaybeCount(dashboardCounts.products) : '—'} hint={t('productModule')} tone="blue" />
              <SummaryCard label={t('pages')} value={canReadCms ? formatMaybeCount(dashboardCounts.pages) : '—'} hint={t('cmsLanding')} tone="amber" />
              <SummaryCard label={t('templates')} value={canReadTemplates ? formatMaybeCount(dashboardCounts.templates) : '—'} hint={t('certificateList')} tone="green" />
            </div>

            <div className="rounded-[24px] border border-[#d5e1ea] bg-white/94 p-4 shadow-[0_16px_30px_rgba(15,23,42,0.05)]" data-tour="dashboard-first-time">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--ac-brand)' }}>{t('gettingStarted')}</div>
              <div className="mt-2 text-base font-semibold tracking-tight text-slate-950">{t('firstTimeTitle')}</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">{t('firstTimeSubtitle')}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.95fr)]">
        <DashboardSection
          label={t('epcManagement')}
          title={t('epcGenerated')}
          subtitle={t('publicVerifyHint')}
          action={
            <div className="rounded-full border border-[#d4e1ea] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t('epcGenerated')}
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <MetricCard
              title={t('epcGenerated')}
              value={canReadEpc ? formatMaybeCount(epcGeneratedCount) : '—'}
              hint={t('epcGenerated')}
              tone="blue"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 8V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5V8" />
                  <rect x="5" y="8" width="14" height="11" rx="2.5" />
                  <path d="M9 12h6M9 15.5h6" />
                </svg>
              }
            />
            <MetricCard
              title={t('epcActive')}
              value={canReadEpc ? formatMaybeCount(epcActiveCount) : '—'}
              hint={t('epcActive')}
              tone="green"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <path d="m9.5 12 1.7 1.7L14.8 10" />
                </svg>
              }
            />
            <MetricCard
              title={t('epcInactive')}
              value={canReadEpc ? formatMaybeCount(epcInactiveCount) : '—'}
              hint={t('epcInactive')}
              tone="slate"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M9 12h6" />
                </svg>
              }
            />
          </div>
        </DashboardSection>

        <DashboardSection
          label={t('publicVerifyPage')}
          title={t('publicVerifyPage')}
          subtitle={t('publicVerifyHint')}
          className=""
          style={{ background: 'linear-gradient(180deg, #ffffff 0%, var(--ac-bg-soft) 100%)' }}
          action={
            <div className="rounded-full border border-[#d4e1ea] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t('open')}
            </div>
          }
        >
          <div className="rounded-[24px] border border-slate-900/10 bg-slate-950 p-4 shadow-[0_18px_34px_rgba(15,23,42,0.18)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('publicVerifyPage')}</div>
            <div className="mt-3 font-mono text-[12px] leading-6 text-slate-100 break-all">{verifyUrl}</div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ActionButton
              className="text-white"
              style={{ background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)', boxShadow: '0 16px 32px rgba(var(--ac-brand-rgb), 0.18)' }}
              onClick={() => openVerifyUrl(verifyUrl)}
            >
              {t('open')}
            </ActionButton>
            <ActionButton
              className="border border-[#c8d4e1] bg-white text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.06)] hover:bg-slate-50"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(verifyUrl);
                } catch {
                  void 0;
                }
              }}
            >
              {t('copyUrl')}
            </ActionButton>
          </div>
        </DashboardSection>
      </div>

    </div>
  );
}
