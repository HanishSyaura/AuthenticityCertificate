import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useCmsStore from '../../store/useCmsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useRecordsStore from '../../store/useRecordsStore';
import { useT } from '../../i18n/useT';

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
  const [showGuideBanner, setShowGuideBanner] = useState(false);
  const { pages, fetchPages } = useCmsStore((s) => ({ pages: s.pages, fetchPages: s.fetchPages }));
  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({ templates: s.templates, fetchTemplates: s.fetchTemplates }));
  const { products, fetchProducts } = useRecordsStore((s) => ({ products: s.products, fetchProducts: s.fetchProducts }));

  useEffect(() => {
    fetchPages();
    fetchTemplates();
    fetchProducts();
  }, [fetchPages, fetchTemplates, fetchProducts]);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('ac_seen_guide');
      setShowGuideBanner(!seen);
    } catch {
      setShowGuideBanner(true);
    }
  }, []);

  const productCount = useMemo(() => (Array.isArray(products) ? products.length : 0), [products]);
  const templateCount = useMemo(() => (Array.isArray(templates) ? templates.length : 0), [templates]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900">{t('dashboard')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('dashboardSubtitle')}</p>
      </div>

      {showGuideBanner ? (
        <div className="ac-card mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">{t('firstTimeTitle')}</div>
              <div className="mt-1 text-sm text-zinc-600">{t('firstTimeSubtitle')}</div>
            </div>
            <div className="flex gap-2">
              <Link to="/admin/guide" className="ac-btn ac-btn-primary px-3 py-2 text-xs">
                {t('openGuide')}
              </Link>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  try {
                    localStorage.setItem('ac_seen_guide', '1');
                  } catch {
                    setShowGuideBanner(false);
                  }
                  setShowGuideBanner(false);
                }}
              >
                {t('dismiss')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title={t('records')} value={productCount} hint={t('products')} />
        <Card title={t('cmsBuilder')} value={pages.length} hint={t('pages')} />
        <Card title={t('certTemplates')} value={templateCount} hint={t('templates')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link to="/admin/cms" className="ac-card p-4 hover:bg-zinc-50">
          <div className="text-sm font-semibold text-zinc-900">{t('cmsBuilder')}</div>
          <div className="mt-1 text-xs text-zinc-600">{t('cmsSubheading')}</div>
        </Link>
        <Link to="/admin/cert-templates" className="ac-card p-4 hover:bg-zinc-50">
          <div className="text-sm font-semibold text-zinc-900">{t('certTemplates')}</div>
          <div className="mt-1 text-xs text-zinc-600">{t('certTplSubheading')}</div>
        </Link>
      </div>

      <div className="ac-card mt-4 p-4">
        <div className="text-xs font-semibold text-zinc-600">{t('publicVerifyPage')}</div>
        <div className="mt-1 text-xs text-zinc-600">{t('publicVerifyHint')}</div>
        <div className="mt-2 font-mono text-[11px] text-zinc-800">/verify/&lt;CERTIFICATE_ID&gt;</div>
      </div>
    </div>
  );
}
