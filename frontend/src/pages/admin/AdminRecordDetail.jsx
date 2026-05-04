import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useRecordsStore from '../../store/useRecordsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { createAdminApi } from '../../utils/adminApi';
import { useT } from '../../i18n/useT';
import RichTextEditor from '../../components/admin/RichTextEditor';
import { isRichTextEmpty, toQuillHtml } from '../../utils/richText';

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

  const { products, categories, loading, error, lastSyncAt, fetchProducts, fetchCategories, updateProduct } = useRecordsStore((s) => ({
    products: s.products,
    categories: s.categories,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchProducts: s.fetchProducts,
    fetchCategories: s.fetchCategories,
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
  const [status, setStatus] = useState('active');
  const [remark, setRemark] = useState('');

  const [cmsPageId, setCmsPageId] = useState('');
  const [certificateTemplateId, setCertificateTemplateId] = useState('');

  const [landingPages, setLandingPages] = useState([]);

  const categoryByCode = useMemo(() => {
    const map = new Map();
    (Array.isArray(categories) ? categories : []).forEach((c) => {
      if (!c?.code) return;
      map.set(String(c.code), c);
    });
    return map;
  }, [categories]);

  useEffect(() => {
    void fetchProducts();
    void fetchCategories();
    void fetchTemplates();
  }, [fetchProducts, fetchCategories, fetchTemplates]);

  useEffect(() => {
    if (!token) return;
    const api = createAdminApi({ token });
    api.get('/cms/pages', { params: { kind: 'landing' } })
      .then((res) => setLandingPages(Array.isArray(res?.data?.data) ? res.data.data : []))
      .catch(() => setLandingPages([]));
  }, [token]);

  useEffect(() => {
    if (!product) return;
    setSku(product.sku || '');
    setName(product.name || '');
    setProductCode(product.code || '');
    setCategory(product.category || '');
    setStatus(String(product.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active');
    setRemark(toQuillHtml(product.remark || ''));
    setCmsPageId(product.cmsPageId != null ? String(product.cmsPageId) : '');
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
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="ac-input">
                <option value="">{t('selectCategory')}</option>
                {(Array.isArray(categories) ? categories : [])
                  .filter((c) => Boolean(c?.code) && (c?.isActive !== false || String(c.code) === String(category)))
                  .map((c) => (
                    <option key={c.id} value={String(c.code)}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </select>
              {category ? (
                <div className="mt-1 text-[11px] text-zinc-500">
                  {categoryByCode.get(String(category))?.name ? categoryByCode.get(String(category))?.name : null}
                </div>
              ) : null}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('status')}</div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input type="radio" name="productStatusDetail" value="active" checked={status === 'active'} onChange={() => setStatus('active')} />
                  {t('active')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="radio"
                    name="productStatusDetail"
                    value="inactive"
                    checked={status === 'inactive'}
                    onChange={() => setStatus('inactive')}
                  />
                  {t('inactive')}
                </label>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('remark')}</div>
              <RichTextEditor value={remark} onChange={setRemark} />
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
                    {String(tpl?.certificateId || '').trim() ? `${tpl.certificateId} — ${tpl.name}` : tpl.name}
                  </option>
                ))}
              </select>
              <button type="button" className="mt-2 text-[11px] font-semibold underline" onClick={() => navigate('/admin/certificates')}>
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
                      status: String(status || '').trim() || 'active',
                      remark: isRichTextEmpty(remark) ? null : String(remark || ''),
                      cmsPageId: cmsPageId ? Number(cmsPageId) : null,
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
