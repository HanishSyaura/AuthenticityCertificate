import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useRecordsStore from '../../store/useRecordsStore';
import useCmsStore from '../../store/useCmsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import { useT } from '../../i18n/useT';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function toInt(input) {
  const n = Number(input);
  if (Number.isFinite(n)) return n;
  return null;
}

export default function AdminRecordDetail() {
  const { t } = useT();
  const { id } = useParams();

  const {
    products,
    batches,
    loading,
    error,
    lastSyncAt,
    fetchProducts,
    fetchBatches,
    createBatch,
    generateCertificates,
    updateProduct
  } = useRecordsStore((s) => ({
    products: s.products,
    batches: s.batchesByProductId[String(id)] || [],
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchProducts: s.fetchProducts,
    fetchBatches: s.fetchBatches,
    createBatch: s.createBatch,
    generateCertificates: s.generateCertificates,
    updateProduct: s.updateProduct
  }));

  const { pages, fetchPages } = useCmsStore((s) => ({ pages: s.pages, fetchPages: s.fetchPages }));
  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({ templates: s.templates, fetchTemplates: s.fetchTemplates }));

  const product = useMemo(() => products.find((p) => String(p.id) === String(id)) || null, [products, id]);

  const [batchNo, setBatchNo] = useState('');
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [certType, setCertType] = useState('unit');
  const [certQty, setCertQty] = useState('');
  const [lastGenerated, setLastGenerated] = useState(null);

  const [origin, setOrigin] = useState('');
  const [description, setDescription] = useState('');
  const [cmsPageId, setCmsPageId] = useState('');
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    void fetchPages();
    void fetchTemplates();
  }, [fetchPages, fetchTemplates]);

  useEffect(() => {
    if (!id) return;
    void fetchBatches(id);
  }, [id, fetchBatches]);

  useEffect(() => {
    if (!product) return;
    setOrigin(product.origin || '');
    setDescription(product.description || '');
    setCmsPageId(product.cmsPageId ? String(product.cmsPageId) : '');
    setTemplateId(product.certificateTemplateId ? String(product.certificateTemplateId) : '');
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
                {product.name} <span className="font-mono text-xs text-zinc-500">({product.code})</span>
              </span>
            ) : (
              <span className="font-mono text-xs">{id}</span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchBatches(id)}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">{t('batches')}</div>
          {loading ? (
            <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm font-semibold text-zinc-900">{t('noBatches')}</div>
              <div className="mt-1 text-xs text-zinc-600">{t('noBatchesHint')}</div>
            </div>
          ) : (
            <div>
              {batches.map((b) => {
                const certs = Array.isArray(b.certificates) ? b.certificates : [];
                const expanded = String(expandedBatchId) === String(b.id);
                return (
                  <div key={b.id} className="border-b border-zinc-100 last:border-b-0">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                      onClick={() => setExpandedBatchId(expanded ? null : b.id)}
                    >
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">{b.batchNo}</div>
                        <div className="mt-0.5 text-[11px] text-zinc-500">
                          {t('certificatesCount', { value: certs.length })} • {formatDate(b.createdAt)}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">{expanded ? t('collapse') : t('expand')}</div>
                    </button>
                    {expanded ? (
                      <div className="px-4 pb-4">
                        <div className="rounded-xl border border-zinc-200 bg-white p-4">
                          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('generateCertificates')}</div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr_140px]">
                            <div>
                              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('type')}</div>
                              <select
                                value={certType}
                                onChange={(e) => setCertType(e.target.value)}
                                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                              >
                                <option value="batch">batch</option>
                                <option value="unit">unit</option>
                              </select>
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('quantityOptional')}</div>
                              <input
                                value={certQty}
                                onChange={(e) => setCertQty(e.target.value)}
                                placeholder={t('quantityHint')}
                                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                className="ac-btn w-full px-3 py-2 text-xs"
                                onClick={async () => {
                                  const qty = toInt(certQty);
                                  const created = await generateCertificates({
                                    batchId: b.id,
                                    type: certType,
                                    quantity: qty != null ? qty : undefined
                                  });
                                  const count = Array.isArray(created) ? created.length : 0;
                                  setLastGenerated({ batchId: b.id, count, at: Date.now() });
                                  setCertQty('');
                                  await fetchBatches(id);
                                }}
                              >
                                {t('generate')}
                              </button>
                            </div>
                          </div>
                          {lastGenerated && String(lastGenerated.batchId) === String(b.id) ? (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                              {t('generatedCount', { value: lastGenerated.count })}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-3 rounded-xl border border-zinc-200 bg-white">
                          <div className="overflow-x-auto">
                            <div className="min-w-[560px]">
                              <div className="grid grid-cols-[1fr_120px_140px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
                                <div>{t('certificateId')}</div>
                                <div>{t('status')}</div>
                                <div>{t('created')}</div>
                              </div>
                              {certs.length === 0 ? (
                                <div className="p-4 text-xs text-zinc-600">{t('noCertificatesYet')}</div>
                              ) : (
                                certs.slice(0, 50).map((c) => (
                                  <div
                                    key={c.certificateId}
                                    className="grid grid-cols-[1fr_120px_140px] gap-4 border-b border-zinc-100 px-4 py-3 text-xs text-zinc-800 last:border-b-0"
                                  >
                                    <div className="font-mono text-[11px] text-zinc-900">{c.certificateId}</div>
                                    <div className="text-[11px] text-zinc-700">{c.status}</div>
                                    <div className="text-[11px] text-zinc-500">{formatDate(c.createdAt)}</div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('productSettings')}</div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('origin')}</div>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('description')}</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('cmsPage')}</div>
              <select
                value={cmsPageId}
                onChange={(e) => setCmsPageId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="">{t('none')}</option>
                {(pages || []).map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('certTemplate')}</div>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="">{t('none')}</option>
                {(templates || []).map((tpl) => (
                  <option key={tpl.id} value={String(tpl.id)}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!product?.id}
                onClick={async () => {
                  if (!product?.id) return;
                  await updateProduct({
                    id: product.id,
                    patch: {
                      origin: String(origin || '').trim() || null,
                      description: String(description || '').trim() || null,
                      cmsPageId: cmsPageId ? toInt(cmsPageId) : null,
                      certificateTemplateId: templateId ? toInt(templateId) : null
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
          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('createBatch')}</div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('batchNo')}</div>
              <input
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
              />
            </div>
            <button
              type="button"
              className="ac-btn w-full px-3 py-2 text-xs"
              onClick={async () => {
                const bn = String(batchNo || '').trim();
                if (!bn) return;
                await createBatch({ productId: id, batchNo: bn });
                setBatchNo('');
                await fetchBatches(id);
              }}
            >
              {t('create')}
            </button>
            <div className="text-[11px] text-zinc-500">{t('createBatchHint')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
