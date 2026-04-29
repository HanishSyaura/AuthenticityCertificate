import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useRecordsStore from '../../store/useRecordsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { createAdminApi } from '../../utils/adminApi';
import { useT } from '../../i18n/useT';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default function AdminRecordDetail() {
  const { t } = useT();
  const navigate = useNavigate();
  const { id } = useParams();

  const { products, loading, error, lastSyncAt, fetchProducts, updateProduct } = useRecordsStore((s) => ({
    products: s.products,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchProducts: s.fetchProducts,
    updateProduct: s.updateProduct
  }));

  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    fetchTemplates: s.fetchTemplates
  }));

  const { token } = useAdminAuthStore((s) => ({ token: s.token }));

  const product = useMemo(() => products.find((p) => String(p.id) === String(id)) || null, [products, id]);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');

  const [cmsPageId, setCmsPageId] = useState('');
  const [cmsCertificatePageId, setCmsCertificatePageId] = useState('');
  const [certificateTemplateId, setCertificateTemplateId] = useState('');

  const [landingPages, setLandingPages] = useState([]);
  const [certificatePages, setCertificatePages] = useState([]);

  useEffect(() => {
    void fetchProducts();
    void fetchTemplates();
  }, [fetchProducts, fetchTemplates]);

  useEffect(() => {
    if (!token) return;
    const api = createAdminApi({ token });
    Promise.all([
      api.get('/cms/pages', { params: { kind: 'landing' } }).catch(() => ({ data: { data: [] } })),
      api.get('/cms/pages', { params: { kind: 'certificate' } }).catch(() => ({ data: { data: [] } }))
    ]).then(([a, b]) => {
      setLandingPages(Array.isArray(a?.data?.data) ? a.data.data : []);
      setCertificatePages(Array.isArray(b?.data?.data) ? b.data.data : []);
    });
  }, [token]);

  useEffect(() => {
    if (!product) return;
    setSku(product.sku || '');
    setName(product.name || '');
    setProductCode(product.code || '');
    setCategory(product.category || '');
    setStatus(product.status || '');
    setRemark(product.remark || '');
    setCmsPageId(product.cmsPageId != null ? String(product.cmsPageId) : '');
    setCmsCertificatePageId(product.cmsCertificatePageId != null ? String(product.cmsCertificatePageId) : '');
    setCertificateTemplateId(product.certificateTemplateId != null ? String(product.certificateTemplateId) : '');
  }, [product]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-500">
            <Link className="underline" to="/admin/records">
              {t('backToRecords')}
            </Link>
          </div>
          <h2 className="mt-2 text-base font-semibold text-zinc-900">{t('recordDetails')}</h2>
          <div className="mt-1 text-sm text-zinc-600">
            {product ? (
              <span>
                {product.name}{' '}
                <span className="font-mono text-xs text-zinc-500">({product.sku} • {product.code})</span>
              </span>
            ) : (
              <span className="font-mono text-xs">{id}</span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchProducts()}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('productSettings')}</div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('sku')}</div>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('name')}</div>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('productCode')}</div>
              <input value={productCode} onChange={(e) => setProductCode(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('category')}</div>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('status')}</div>
              <input value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('remark')}</div>
              <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('links')}</div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('certTemplate')}</div>
              <select value={certificateTemplateId} onChange={(e) => setCertificateTemplateId(e.target.value)} className="ac-input">
                <option value="">{t('none')}</option>
                {(Array.isArray(templates) ? templates : []).map((tpl) => (
                  <option key={tpl.id} value={String(tpl.id)}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <button type="button" className="mt-2 text-[11px] font-semibold underline" onClick={() => navigate('/admin/cert-templates')}>
                {t('openModule')}
              </button>
            </div>

            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('cmsLanding')}</div>
              <select value={cmsPageId} onChange={(e) => setCmsPageId(e.target.value)} className="ac-input">
                <option value="">{t('none')}</option>
                {landingPages.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
              <button type="button" className="mt-2 text-[11px] font-semibold underline" onClick={() => navigate('/admin/cms')}>
                {t('openModule')}
              </button>
            </div>

            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('cmsCertificate')}</div>
              <select value={cmsCertificatePageId} onChange={(e) => setCmsCertificatePageId(e.target.value)} className="ac-input">
                <option value="">{t('none')}</option>
                {certificatePages.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
              <button type="button" className="mt-2 text-[11px] font-semibold underline" onClick={() => navigate('/admin/cms-certificate')}>
                {t('openModule')}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!product?.id || loading}
                onClick={async () => {
                  if (!product?.id) return;
                  await updateProduct({
                    id: product.id,
                    patch: {
                      sku: String(sku || '').trim(),
                      name: String(name || '').trim(),
                      product_code: String(productCode || '').trim(),
                      category: String(category || '').trim(),
                      status: String(status || '').trim(),
                      remark: String(remark || '').trim() || null,
                      cmsPageId: cmsPageId ? Number(cmsPageId) : null,
                      cmsCertificatePageId: cmsCertificatePageId ? Number(cmsCertificatePageId) : null,
                      certificateTemplateId: certificateTemplateId ? Number(certificateTemplateId) : null
                    }
                  });
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
