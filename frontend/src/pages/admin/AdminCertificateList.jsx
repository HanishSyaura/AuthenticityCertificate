import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useRecordsStore from '../../store/useRecordsStore';
import { useT } from '../../i18n/useT';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function AdminCertificateList() {
  const { t } = useT();
  const navigate = useNavigate();

  const { templates, loading, error, fetchTemplates } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    loading: s.loading,
    error: s.error,
    fetchTemplates: s.fetchTemplates
  }));

  const { products, fetchProducts } = useRecordsStore((s) => ({
    products: s.products,
    fetchProducts: s.fetchProducts
  }));

  useEffect(() => {
    void fetchTemplates();
    void fetchProducts();
  }, [fetchProducts, fetchTemplates]);

  const assignedCountByTemplateId = useMemo(() => {
    const map = new Map();
    for (const p of Array.isArray(products) ? products : []) {
      const tid = p?.certificateTemplateId != null ? String(p.certificateTemplateId) : null;
      if (!tid) continue;
      map.set(tid, (map.get(tid) || 0) + 1);
    }
    return map;
  }, [products]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('certificateList')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('certificateListSubtitle')}</p>
        </div>
        <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => navigate('/admin/certificates/new')}>
          {t('addCertificate')}
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1fr_120px_120px_110px] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
          <div>{t('name')}</div>
          <div>{t('fields')}</div>
          <div>{t('products')}</div>
          <div>{t('created')}</div>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-zinc-600">{t('loading')}</div>
        ) : (Array.isArray(templates) ? templates : []).length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-sm font-semibold text-zinc-900">{t('noCertificates')}</div>
            <div className="mt-1 text-xs text-zinc-600">{t('noCertificatesHint')}</div>
          </div>
        ) : (
          (Array.isArray(templates) ? templates : []).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => navigate(`/admin/certificates/${tpl.id}`)}
              className="grid w-full grid-cols-[1fr_120px_120px_110px] gap-3 border-b border-zinc-100 px-4 py-3 text-left text-xs text-zinc-800 hover:bg-zinc-50 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-zinc-900">{tpl.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-500">#{tpl.id}</div>
              </div>
              <div className="text-[11px] text-zinc-700">{Array.isArray(tpl.layoutJson) ? tpl.layoutJson.length : 0}</div>
              <div className="text-[11px] text-zinc-700">{assignedCountByTemplateId.get(String(tpl.id)) || 0}</div>
              <div className="text-[11px] text-zinc-500">{formatDate(tpl.createdAt)}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

