import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useCmsStore from '../../store/useCmsStore';
import { ADMIN_KEYS } from '../../utils/adminKeys';
import { readJson } from '../../utils/storage';
import { useT } from '../../i18n/useT';

function Card({ title, value, hint }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-xs font-semibold text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-zinc-600">{hint}</div> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useT();
  const { pages, fetchPages } = useCmsStore((s) => ({ pages: s.pages, fetchPages: s.fetchPages }));

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const templateCount = useMemo(() => {
    const items = readJson(ADMIN_KEYS.certTemplates, []);
    return Array.isArray(items) ? items.length : 0;
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900">{t('dashboard')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('dashboardSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title={t('cmsBuilder')} value={pages.length} hint={t('pages')} />
        <Card title={t('certTemplates')} value={templateCount} hint={t('demo')} />
        <Card title={t('publicVerifyPage')} value="BN-TEST-123" hint="/verify/BN-TEST-123" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link to="/admin/cms" className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100">
          <div className="text-sm font-semibold text-zinc-900">{t('cmsBuilder')}</div>
          <div className="mt-1 text-xs text-zinc-600">{t('cmsSubheading')}</div>
        </Link>
        <Link to="/admin/cert-templates" className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100">
          <div className="text-sm font-semibold text-zinc-900">{t('certTemplates')}</div>
          <div className="mt-1 text-xs text-zinc-600">{t('certTplSubheading')}</div>
        </Link>
      </div>
    </div>
  );
}
