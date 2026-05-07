import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useCmsStore from '../../store/useCmsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useRecordsStore from '../../store/useRecordsStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import useTourStore from '../../store/useTourStore';
import { getAdminGettingStartedTourSteps } from '../../tour/adminGettingStartedTour';
import { createAdminApi } from '../../utils/adminApi';
import { hasPermission } from '../../utils/permissions';

function Card({ title, value, hint }) {
  return (
    <div className="ac-card p-4">
      <div className="text-xs font-semibold text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-zinc-600">{hint}</div> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useT();
  const [tourAutoStarted, setTourAutoStarted] = useState(false);
  const [latestEpc, setLatestEpc] = useState('');
  const { openTour, hasSeen } = useTourStore((s) => ({ openTour: s.openTour, hasSeen: s.hasSeen }));
  const { pages, fetchPages } = useCmsStore((s) => ({ pages: s.pages, fetchPages: s.fetchPages }));
  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({ templates: s.templates, fetchTemplates: s.fetchTemplates }));
  const { products, fetchProducts } = useRecordsStore((s) => ({ products: s.products, fetchProducts: s.fetchProducts }));
  const { token, user } = useAdminAuthStore((s) => ({ token: s.token, user: s.user }));

  const role = user?.role || 'admin';
  const perms = useMemo(() => (Array.isArray(user?.permissions) ? user.permissions : []), [user?.permissions]);
  const canReadEpc = useMemo(() => {
    if (role === 'super_admin') return true;
    if (hasPermission(perms, '*')) return true;
    return ['epc.read', 'epc.write', 'epc.batch.view', 'epc.batch.create', 'epc.scan.access', 'epc.production.access'].some((k) =>
      hasPermission(perms, k)
    );
  }, [perms, role]);

  useEffect(() => {
    fetchPages();
    fetchTemplates();
    fetchProducts();
  }, [fetchPages, fetchTemplates, fetchProducts]);

  useEffect(() => {
    if (!token || !canReadEpc) return;
    let alive = true;
    (async () => {
      try {
        const api = createAdminApi({ token });
        const res = await api.get('/epc/items', { params: { limit: 1, offset: 0 } });
        const epc = String(res?.data?.data?.items?.[0]?.epcCode || '').trim();
        if (!alive) return;
        setLatestEpc(epc);
      } catch {
        if (!alive) return;
        setLatestEpc('');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, canReadEpc]);

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

  const productCount = useMemo(() => (Array.isArray(products) ? products.length : 0), [products]);
  const templateCount = useMemo(() => (Array.isArray(templates) ? templates.length : 0), [templates]);
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
    <div className="ac-page">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900">{t('dashboard')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('dashboardSubtitle')}</p>
      </div>

      <div className="ac-card mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">{t('firstTimeTitle')}</div>
            <div className="mt-1 text-sm text-zinc-600">{t('firstTimeSubtitle')}</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="ac-btn ac-btn-primary px-3 py-2 text-xs"
              onClick={() => openTour({ steps: getAdminGettingStartedTourSteps(t), storageKey: 'ac_seen_admin_tour_v1' })}
            >
              {t('tourStart')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title={t('productModule')} value={productCount} hint={t('products')} />
        <Card title={t('cmsLanding')} value={pages.length} hint={t('pages')} />
        <Card title={t('certificateList')} value={templateCount} hint={t('templates')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link to="/admin/cms" className="ac-card p-4 hover:bg-zinc-50">
          <div className="text-sm font-semibold text-zinc-900">{t('cmsBuilder')}</div>
          <div className="mt-1 text-xs text-zinc-600">{t('cmsSubheading')}</div>
        </Link>
        <Link to="/admin/certificates" className="ac-card p-4 hover:bg-zinc-50">
          <div className="text-sm font-semibold text-zinc-900">{t('certificateList')}</div>
          <div className="mt-1 text-xs text-zinc-600">{t('certTplSubheading')}</div>
        </Link>
      </div>

      <div className="ac-card mt-4 p-4">
        <div className="text-xs font-semibold text-zinc-600">{t('publicVerifyPage')}</div>
        <div className="mt-1 text-xs text-zinc-600">{t('publicVerifyHint')}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[240px] flex-1 font-mono text-[11px] text-zinc-800">{verifyUrl}</div>
          <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-[11px]" onClick={() => openVerifyUrl(verifyUrl)}>
            {t('open')}
          </button>
          <button
            type="button"
            className="ac-btn ac-btn-soft px-3 py-2 text-[11px]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(verifyUrl);
              } catch {
                void 0;
              }
            }}
          >
            {t('copyUrl')}
          </button>
        </div>
      </div>
    </div>
  );
}
