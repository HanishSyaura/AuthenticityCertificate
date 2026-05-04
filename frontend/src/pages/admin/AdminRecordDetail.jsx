import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useRecordsStore from '../../store/useRecordsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { createAdminApi } from '../../utils/adminApi';
import { useT } from '../../i18n/useT';
import { stripHtmlToText } from '../../utils/richText';

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
  const [supportingCertificates, setSupportingCertificates] = useState([]);
  const [supportingLoading, setSupportingLoading] = useState(false);
  const [supportingError, setSupportingError] = useState(null);

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
    setRemark(stripHtmlToText(product.remark || ''));
    setCmsPageId(product.cmsPageId != null ? String(product.cmsPageId) : '');
    setCertificateTemplateId(product.certificateTemplateId != null ? String(product.certificateTemplateId) : '');
  }, [product]);

  useEffect(() => {
    if (!token || !product?.id) return;
    const api = createAdminApi({ token });
    setSupportingLoading(true);
    setSupportingError(null);
    api
      .get(`/products/${encodeURIComponent(product.id)}/supporting-certificates`)
      .then((res) => setSupportingCertificates(Array.isArray(res?.data?.data) ? res.data.data : []))
      .catch((e) => {
        const msg = e?.response?.data?.message || e?.message || 'Failed to load supporting certificates';
        setSupportingCertificates([]);
        setSupportingError(msg);
      })
      .finally(() => setSupportingLoading(false));
  }, [product?.id, token]);

  const reorderSupporting = async (next) => {
    if (!token || !product?.id) return;
    const orderedIds = (Array.isArray(next) ? next : []).map((r) => Number(r?.id)).filter((v) => Number.isFinite(v) && v > 0);
    if (!orderedIds.length) return;
    const api = createAdminApi({ token });
    setSupportingLoading(true);
    setSupportingError(null);
    try {
      const res = await api.patch(`/products/${encodeURIComponent(product.id)}/supporting-certificates/order`, { orderedIds });
      setSupportingCertificates(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to reorder supporting certificates';
      setSupportingError(msg);
    } finally {
      setSupportingLoading(false);
    }
  };

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
              <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
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
                        remark: String(remark || '').trim() || null,
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

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-zinc-600">{t('supportingCertificates')}</div>
              <button
                type="button"
                disabled={!product?.id || !token || supportingLoading}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                onClick={async () => {
                  if (!token || !product?.id) return;
                  const api = createAdminApi({ token });
                  setSupportingLoading(true);
                  setSupportingError(null);
                  try {
                    const res = await api.post(`/products/${encodeURIComponent(product.id)}/supporting-certificates`, {});
                    const created = res?.data?.data;
                    const next = [...(Array.isArray(supportingCertificates) ? supportingCertificates : []), created].filter(Boolean);
                    setSupportingCertificates(next);
                  } catch (e) {
                    const msg = e?.response?.data?.message || e?.message || 'Failed to create supporting certificate';
                    setSupportingError(msg);
                  } finally {
                    setSupportingLoading(false);
                  }
                }}
              >
                {t('addSupportingCertificate')}
              </button>
            </div>

            {supportingError ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{supportingError}</div> : null}

            {!supportingCertificates.length ? (
              <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{supportingLoading ? t('loading') : t('none')}</div>
            ) : (
              <div className="space-y-3">
                {supportingCertificates.map((row, idx) => (
                  <div key={row.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-zinc-900">
                        {t('supportingCertificate')} #{idx + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                          disabled={supportingLoading || idx === 0}
                          onClick={() => {
                            const next = [...supportingCertificates];
                            const tmp = next[idx - 1];
                            next[idx - 1] = next[idx];
                            next[idx] = tmp;
                            void reorderSupporting(next);
                          }}
                        >
                          {t('moveUp')}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                          disabled={supportingLoading || idx === supportingCertificates.length - 1}
                          onClick={() => {
                            const next = [...supportingCertificates];
                            const tmp = next[idx + 1];
                            next[idx + 1] = next[idx];
                            next[idx] = tmp;
                            void reorderSupporting(next);
                          }}
                        >
                          {t('moveDown')}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                          disabled={supportingLoading}
                          onClick={async () => {
                            if (!token || !product?.id) return;
                            const api = createAdminApi({ token });
                            setSupportingLoading(true);
                            setSupportingError(null);
                            try {
                              await api.delete(`/products/${encodeURIComponent(product.id)}/supporting-certificates/${encodeURIComponent(row.id)}`);
                              setSupportingCertificates(supportingCertificates.filter((r) => String(r.id) !== String(row.id)));
                            } catch (e) {
                              const msg = e?.response?.data?.message || e?.message || 'Failed to delete supporting certificate';
                              setSupportingError(msg);
                            } finally {
                              setSupportingLoading(false);
                            }
                          }}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div>
                        <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('title')}</div>
                        <input
                          value={row.title || ''}
                          onChange={(e) => {
                            const next = supportingCertificates.map((r) => (String(r.id) === String(row.id) ? { ...r, title: e.target.value } : r));
                            setSupportingCertificates(next);
                          }}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('certTemplate')}</div>
                        <select
                          value={row.certificateTemplateId != null ? String(row.certificateTemplateId) : ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const next = supportingCertificates.map((r) =>
                              String(r.id) === String(row.id) ? { ...r, certificateTemplateId: v ? Number(v) : null } : r
                            );
                            setSupportingCertificates(next);
                          }}
                          className="ac-input"
                        >
                          <option value="">{t('none')}</option>
                          {(Array.isArray(templates) ? templates : []).map((tpl) => (
                            <option key={tpl.id} value={String(tpl.id)}>
                              {String(tpl?.certificateId || '').trim() ? `${tpl.certificateId} — ${tpl.name}` : tpl.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className="ac-btn px-3 py-2 text-xs"
                        disabled={supportingLoading}
                        onClick={async () => {
                          if (!token || !product?.id) return;
                          const api = createAdminApi({ token });
                          setSupportingLoading(true);
                          setSupportingError(null);
                          try {
                            const res = await api.patch(
                              `/products/${encodeURIComponent(product.id)}/supporting-certificates/${encodeURIComponent(row.id)}`,
                              {
                                title: row.title ? String(row.title).trim() : null,
                                certificateTemplateId: row.certificateTemplateId != null ? Number(row.certificateTemplateId) : null
                              }
                            );
                            const updated = res?.data?.data;
                            setSupportingCertificates(
                              supportingCertificates.map((r) => (String(r.id) === String(row.id) ? updated : r)).filter(Boolean)
                            );
                          } catch (e) {
                            const msg = e?.response?.data?.message || e?.message || 'Failed to update supporting certificate';
                            setSupportingError(msg);
                          } finally {
                            setSupportingLoading(false);
                          }
                        }}
                      >
                        {t('save')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
