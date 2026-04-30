import React, { useEffect, useMemo, useState } from 'react';
import useRecordsStore from '../../store/useRecordsStore';
import useEpcStore from '../../store/useEpcStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import { useT } from '../../i18n/useT';
import RichTextEditor from '../../components/admin/RichTextEditor';

function formatDateTime(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function AdminEpc() {
  const { t } = useT();

  const { products, fetchProducts } = useRecordsStore((s) => ({
    products: s.products,
    fetchProducts: s.fetchProducts
  }));

  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    fetchTemplates: s.fetchTemplates
  }));

  const {
    corpCodes,
    batches,
    loading,
    error,
    lastGenerated,
    fetchCorpCodes,
    fetchBatches,
    generateBatch,
    exportBatchXlsx,
    importProductionXlsx,
    markProductionDone,
    deleteBatch,
    importExistingXlsx,
    clearLastGenerated
  } = useEpcStore((s) => ({
    corpCodes: s.corpCodes,
    batches: s.batches,
    loading: s.loading,
    error: s.error,
    lastGenerated: s.lastGenerated,
    fetchCorpCodes: s.fetchCorpCodes,
    fetchBatches: s.fetchBatches,
    generateBatch: s.generateBatch,
    exportBatchXlsx: s.exportBatchXlsx,
    importProductionXlsx: s.importProductionXlsx,
    markProductionDone: s.markProductionDone,
    deleteBatch: s.deleteBatch,
    importExistingXlsx: s.importExistingXlsx,
    clearLastGenerated: s.clearLastGenerated
  }));

  const [tab, setTab] = useState('create');

  const [corpPrefix, setCorpPrefix] = useState('DA01');
  const [productId, setProductId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchQty, setBatchQty] = useState(1);
  const [remark, setRemark] = useState('');
  const [certificateTemplateId, setCertificateTemplateId] = useState('');
  const [templateData, setTemplateData] = useState({});
  const [importProductId, setImportProductId] = useState('');
  const [importBatchName, setImportBatchName] = useState('');

  useEffect(() => {
    void fetchProducts();
    void fetchTemplates();
    void fetchCorpCodes();
    void fetchBatches({ limit: 50, offset: 0 });
  }, [fetchBatches, fetchCorpCodes, fetchProducts, fetchTemplates]);

  useEffect(() => {
    void corpCodes;
  }, [corpCodes, corpPrefix]);

  const selectedProduct = useMemo(() => (Array.isArray(products) ? products : []).find((p) => String(p.id) === String(productId)) || null, [products, productId]);

  useEffect(() => {
    if (!selectedProduct) return;
    if (selectedProduct.certificateTemplateId != null) {
      setCertificateTemplateId(String(selectedProduct.certificateTemplateId));
    }
  }, [selectedProduct]);

  const selectedTemplate = useMemo(
    () => (Array.isArray(templates) ? templates : []).find((x) => String(x.id) === String(certificateTemplateId)) || null,
    [certificateTemplateId, templates]
  );

  const placeholders = useMemo(() => {
    const raw = selectedTemplate?.placeholders;
    return Array.isArray(raw) ? raw : [];
  }, [selectedTemplate]);

  useEffect(() => {
    const next = {};
    for (const p of placeholders) {
      const key = String(p?.key || '').trim();
      if (!key) continue;
      const existing = templateData?.[key];
      if (existing != null && String(existing).length > 0) {
        next[key] = existing;
        continue;
      }
      const source = String(p?.source || 'manual');
      if (source === 'static') {
        next[key] = String(p?.staticValue || '');
        continue;
      }
      if (source === 'product' && selectedProduct) {
        const bindPath = String(p?.bindPath || '').trim();
        if (bindPath.startsWith('product.')) {
          const prop = bindPath.slice('product.'.length);
          next[key] = selectedProduct?.[prop] == null ? '' : String(selectedProduct[prop]);
          continue;
        }
      }
      next[key] = '';
    }
    setTemplateData(next);
  }, [certificateTemplateId, placeholders, selectedProduct]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-zinc-900">{t('epc')}</div>
          <div className="mt-1 text-sm text-zinc-600">{t('guideStepBatchesBody')}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              tab === 'create' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {t('epcBatchCreation')}
          </button>
          <button
            type="button"
            onClick={() => setTab('batches')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              tab === 'batches' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {t('epcBatches')}
          </button>
          <button
            type="button"
            onClick={() => setTab('production')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              tab === 'production' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {t('productionOrders')}
          </button>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      {tab === 'create' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold text-zinc-600">{t('certificateData')}</div>
            {placeholders.length === 0 ? <div className="text-xs text-zinc-500">{t('selectField')}</div> : null}
            <div className="space-y-3">
              {placeholders.map((p) => {
                const key = String(p?.key || '').trim();
                const label = String(p?.label || key);
                const type = String(p?.type || 'text');
                const help = String(p?.help || '').trim();
                const source = String(p?.source || 'manual');
                const bindPath = String(p?.bindPath || '').trim();
                if (!key) return null;
                return (
                  <div key={key}>
                    <div className="mb-1 text-[11px] font-semibold text-zinc-600">{label}</div>
                    {help ? <div className="-mt-1 mb-2 text-[11px] text-zinc-500">{help}</div> : null}
                    {source === 'product' && bindPath ? (
                      <div className="-mt-1 mb-2 text-[11px] text-zinc-500">
                        {t('sourceProduct')}: {bindPath}
                      </div>
                    ) : null}
                    {type === 'rich_text' ? (
                      <RichTextEditor value={String(templateData?.[key] || '')} onChange={(v) => setTemplateData((prev) => ({ ...(prev || {}), [key]: v }))} />
                    ) : (
                      <input
                        value={String(templateData?.[key] || '')}
                        onChange={(e) => setTemplateData((prev) => ({ ...(prev || {}), [key]: e.target.value }))}
                        disabled={source === 'static'}
                        className="ac-input"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold text-zinc-600">{t('epcBatchCreation')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('corpCode')}</div>
                <input value={corpPrefix} disabled className="ac-input" />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('product')}</div>
                <select value={productId} onChange={(e) => setProductId(e.target.value)} className="ac-input">
                  <option value="">{t('selectProduct')}</option>
                  {(Array.isArray(products) ? products : [])
                    .slice()
                    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                    .map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('certTemplate')}</div>
                <select value={certificateTemplateId} onChange={(e) => setCertificateTemplateId(e.target.value)} className="ac-input">
                  <option value="">{t('none')}</option>
                  {(Array.isArray(templates) ? templates : []).map((tpl) => (
                    <option key={tpl.id} value={String(tpl.id)}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('batchName')}</div>
                <input value={batchName} onChange={(e) => setBatchName(e.target.value)} className="ac-input" />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('batchQty')}</div>
                <input type="number" min={1} max={5000} value={batchQty} onChange={(e) => setBatchQty(Number(e.target.value) || 1)} className="ac-input" />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('remark')}</div>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-400" />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() => {
                    setBatchName('');
                    setBatchQty(1);
                    setRemark('');
                    setTemplateData({});
                    clearLastGenerated();
                  }}
                >
                  {t('clear')}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                  disabled={loading || !corpPrefix || !productId || !batchName || !batchQty}
                  onClick={async () => {
                    const created = await generateBatch({
                      corpPrefix,
                      productId,
                      batchName: String(batchName).trim(),
                      batchQty,
                      remark: String(remark || '').trim() || undefined,
                      certificateTemplateId: certificateTemplateId ? Number(certificateTemplateId) : null,
                      templateData
                    });
                    const batchId = created?.batch?.id;
                    if (batchId) await exportBatchXlsx(batchId);
                    await fetchBatches({ limit: 50, offset: 0 });
                  }}
                >
                  {loading ? t('generating') : t('generate')}
                </button>
              </div>

              {lastGenerated?.batch ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  {t('latestBatch')}: <span className="font-mono">{lastGenerated.batch.batchName}</span> (#{lastGenerated.batch.id})
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'batches' ? (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">{t('epcBatches')}</div>
          <div className="divide-y divide-zinc-100">
            {(Array.isArray(batches) ? batches : []).map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">
                    {b.batchName} <span className="text-xs text-zinc-500">#{b.id}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {b.product?.name || '-'} • {b.batchQty} • {formatDateTime(b.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => exportBatchXlsx(b.id)}>
                    {t('exportXlsx')}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                    onClick={async () => {
                      if (!window.confirm(t('confirmDelete'))) return;
                      await deleteBatch({ batchId: b.id });
                      await fetchBatches({ limit: 50, offset: 0 });
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            ))}
            {(!batches || batches.length === 0) && !loading ? <div className="px-4 py-6 text-xs text-zinc-500">{t('noBatches')}</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'production' ? (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">{t('productionOrders')}</div>
          <div className="divide-y divide-zinc-100">
            {(Array.isArray(batches) ? batches : []).map((b) => {
              const done = Boolean(b.productionDoneAt);
              const uploaded = Boolean(b.productionUploadedAt);
              return (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">
                      {b.batchName} <span className="text-xs text-zinc-500">#{b.id}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {uploaded ? `Uploaded: ${formatDateTime(b.productionUploadedAt)}` : 'Not uploaded'} • {done ? `Done: ${formatDateTime(b.productionDoneAt)}` : 'Not done'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => exportBatchXlsx(b.id)}>
                      {t('download')}
                    </button>
                    <label className="ac-btn ac-btn-soft px-3 py-2 text-xs">
                      {t('importXlsx')}
                      <input
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const base64 = await toBase64(file);
                          await importProductionXlsx({ batchId: b.id, base64 });
                          await fetchBatches({ limit: 50, offset: 0 });
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                      disabled={loading || done}
                      onClick={async () => {
                        await markProductionDone({ batchId: b.id });
                        await fetchBatches({ limit: 50, offset: 0 });
                      }}
                    >
                      {t('markDone')}
                    </button>
                  </div>
                </div>
              );
            })}
            {(!batches || batches.length === 0) && !loading ? <div className="px-4 py-6 text-xs text-zinc-500">{t('noBatches')}</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'production' ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('importExistingEpc')}</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-600">{t('product')}</div>
              <select value={importProductId} onChange={(e) => setImportProductId(e.target.value)} className="ac-input">
                <option value="">{t('selectProduct')}</option>
                {(Array.isArray(products) ? products : [])
                  .slice()
                  .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                  .map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-600">{t('batchName')}</div>
              <input value={importBatchName} onChange={(e) => setImportBatchName(e.target.value)} className="ac-input" placeholder="import-epc" />
            </div>
            <label className={`ac-btn ac-btn-soft px-3 py-2 text-xs ${!importProductId ? 'opacity-50 pointer-events-none' : ''}`}>
              {t('importXlsx')}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const base64 = await toBase64(file);
                  await importExistingXlsx({
                    productId: Number(importProductId),
                    batchName: String(importBatchName || '').trim() || undefined,
                    base64
                  });
                  await fetchBatches({ limit: 50, offset: 0 });
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">{t('importExistingEpcHint')}</div>
        </div>
      ) : null}
    </div>
  );
}
