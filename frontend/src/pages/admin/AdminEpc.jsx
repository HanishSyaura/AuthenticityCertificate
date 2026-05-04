import React, { useEffect, useMemo, useState } from 'react';
import useRecordsStore from '../../store/useRecordsStore';
import useEpcStore from '../../store/useEpcStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import { useT } from '../../i18n/useT';
import RichTextEditor from '../../components/admin/RichTextEditor';
import { isRichTextEmpty, stripHtmlToText } from '../../utils/richText';

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

function getValue(path, data) {
  const parts = String(path || '').split('.');
  let cur = data;
  for (const p of parts) cur = cur?.[p];
  return cur ?? '';
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
    batches,
    items,
    itemTotal,
    loading,
    error,
    lastGenerated,
    fetchCorpCodes,
    fetchBatches,
    fetchItems,
    generateBatch,
    exportBatchXlsx,
    importProductionXlsx,
    markProductionDone,
    deleteBatch,
    recalculateSequence,
    deleteAllBatches,
    importExistingXlsx,
    clearLastGenerated
  } = useEpcStore((s) => ({
    batches: s.batches,
    items: s.items,
    itemTotal: s.itemTotal,
    loading: s.loading,
    error: s.error,
    lastGenerated: s.lastGenerated,
    fetchCorpCodes: s.fetchCorpCodes,
    fetchBatches: s.fetchBatches,
    fetchItems: s.fetchItems,
    generateBatch: s.generateBatch,
    exportBatchXlsx: s.exportBatchXlsx,
    importProductionXlsx: s.importProductionXlsx,
    markProductionDone: s.markProductionDone,
    deleteBatch: s.deleteBatch,
    recalculateSequence: s.recalculateSequence,
    deleteAllBatches: s.deleteAllBatches,
    importExistingXlsx: s.importExistingXlsx,
    clearLastGenerated: s.clearLastGenerated
  }));

  const [tab, setTab] = useState('create');

  const [corpPrefix] = useState('DA01');
  const [productId, setProductId] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchQty, setBatchQty] = useState(1);
  const [remark, setRemark] = useState('');
  const [certificateId, setCertificateId] = useState('');
  const [certificateTemplateId, setCertificateTemplateId] = useState('');
  const [templateData, setTemplateData] = useState({});
  const [importProductId, setImportProductId] = useState('');
  const [importBatchName, setImportBatchName] = useState('');
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsBatch, setItemsBatch] = useState(null);
  const [itemsOffset, setItemsOffset] = useState(0);
  const itemsLimit = 50;

  const openVerifyUrl = (url) => {
    const u = String(url || '').trim();
    if (!u) return;
    const w = window.open(u, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  };

  const openCertificate = async (b) => {
    const certId = String(b?.certificateId || '').trim();
    const batchId = b?.id != null ? Number(b.id) : null;
    if (Number.isFinite(batchId)) {
      const data = await fetchItems({ batchId, limit: 1, offset: 0 });
      const firstEpc = String(data?.items?.[0]?.epcCode || '').trim();
      if (firstEpc) {
        openVerifyUrl(`/verify?epc=${encodeURIComponent(firstEpc)}`);
        return;
      }
    }
    if (!certId) return;
    openVerifyUrl(`/verify/${encodeURIComponent(certId)}`);
  };

  useEffect(() => {
    void fetchProducts();
    void fetchTemplates();
    void fetchCorpCodes();
    void fetchBatches({ limit: 50, offset: 0 });
  }, [fetchBatches, fetchCorpCodes, fetchProducts, fetchTemplates]);

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
    setTemplateData((prev) => {
      const next = {};
      const ctx = {
        product: selectedProduct,
        batch: { batchName, batchQty, productionDate, remark: stripHtmlToText(remark) },
        corpPrefix
      };
      for (const p of placeholders) {
        const key = String(p?.key || '').trim();
        if (!key) continue;
        const source = String(p?.source || 'static');
        if (source === 'static' || source === 'title') {
          next[key] = String(p?.staticValue || '');
          continue;
        }
        if (source === 'product') {
          const bindPath = String(p?.bindPath || '').trim();
          const v = bindPath ? getValue(bindPath, ctx) : '';
          next[key] = v == null ? '' : String(v);
          continue;
        }
        const existing = prev?.[key];
        next[key] = existing == null ? '' : String(existing);
      }
      return next;
    });
  }, [batchName, batchQty, certificateTemplateId, corpPrefix, placeholders, productionDate, remark, selectedProduct]);

  const openBatchItems = async (b) => {
    if (!b?.id) return;
    setItemsBatch(b);
    setItemsOffset(0);
    setItemsOpen(true);
    await fetchItems({ batchId: b.id, limit: itemsLimit, offset: 0 });
  };

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
                const source = String(p?.source || 'static');
                const bindPath = String(p?.bindPath || '').trim();
                if (!key) return null;
                return (
                  <div key={key}>
                    <div className="mb-1 text-[11px] font-semibold text-zinc-600">{label}</div>
                    {source === 'product' && bindPath ? (
                      <div className="-mt-1 mb-2 text-[11px] text-zinc-500">
                        {t('bindTo')}: {bindPath}
                      </div>
                    ) : null}
                    {source === 'product' ? (
                      <input value={String(templateData?.[key] || '')} disabled className="ac-input" />
                    ) : (
                      <div
                        className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
                        dangerouslySetInnerHTML={{ __html: String(templateData?.[key] || '') }}
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
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('productionDate')}</div>
                <input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} className="ac-input" />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('certificateId')}</div>
                <input
                  value={certificateId}
                  onChange={(e) => setCertificateId(e.target.value)}
                  className="ac-input font-mono uppercase"
                  placeholder="BN-XXXXXXXXXX"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-zinc-600">{t('certTemplate')}</div>
                <select value={certificateTemplateId} onChange={(e) => setCertificateTemplateId(e.target.value)} className="ac-input">
                  <option value="">{t('none')}</option>
                  {(Array.isArray(templates) ? templates : []).map((tpl) => (
                    <option key={tpl.id} value={String(tpl.id)}>
                      {String(tpl?.certificateId || '').trim() ? `${tpl.certificateId} — ${tpl.name}` : tpl.name}
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
                <RichTextEditor value={remark} onChange={setRemark} />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() => {
                    setBatchName('');
                    setBatchQty(1);
                    setRemark('');
                    setProductionDate('');
                    setCertificateId('');
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
                      productionDate: String(productionDate || '').trim() || undefined,
                      batchName: String(batchName).trim(),
                      batchQty,
                      remark: isRichTextEmpty(remark) ? undefined : String(remark || ''),
                      certificateId: String(certificateId || '').trim() || undefined,
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-xs font-semibold text-zinc-600">{t('epcBatches')}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                disabled={loading || !corpPrefix}
                onClick={async () => {
                  if (!window.confirm('Reset running number ikut data semasa? (Jika semua EPC sudah dipadam, next akan start dari 00000001)')) return;
                  await recalculateSequence({ corpPrefix });
                }}
              >
                Reset running number
              </button>
              <button
                type="button"
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                disabled={loading}
                onClick={async () => {
                  if (!window.confirm('Delete semua EPC batch & items sekali gus? (Running number akan reset ikut data yang tinggal)')) return;
                  const res = await deleteAllBatches({ corpPrefix });
                  if (res) {
                    await fetchBatches({ limit: 50, offset: 0 });
                  }
                }}
              >
                Delete all
              </button>
            </div>
          </div>
          <div className="divide-y divide-zinc-100">
            {(Array.isArray(batches) ? batches : []).map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">
                    {b.batchName} <span className="text-xs text-zinc-500">#{b.id}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {b.product?.name || '-'} • {b.batchQty} • {formatDateTime(b.createdAt)} • {t('certificateId')}:{' '}
                    {b.certificateId ? <span className="font-mono">{String(b.certificateId)}</span> : '-'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => openBatchItems(b)}>
                    {t('viewEpc')}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                    disabled={!b?.id}
                    onClick={() => void openCertificate(b)}
                  >
                    {t('viewCertificate')}
                  </button>
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

      {itemsOpen && itemsBatch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {t('epcItems')}: {itemsBatch.batchName} <span className="text-xs text-zinc-500">#{itemsBatch.id}</span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {itemsBatch.product?.name || '-'} • {t('certificateId')}: {itemsBatch.certificateId ? <span className="font-mono">{String(itemsBatch.certificateId)}</span> : '-'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={!itemsBatch?.id}
                  onClick={() => void openCertificate(itemsBatch)}
                >
                  {t('viewCertificate')}
                </button>
                <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setItemsOpen(false)}>
                  {t('close')}
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="overflow-auto rounded-lg border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-xs">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-700">{t('epcCode')}</th>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-700">{t('runningNo')}</th>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-700">{t('netWeight')}</th>
                      <th className="px-3 py-2 text-left font-semibold text-zinc-700">{t('caiqNumber')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {(Array.isArray(items) ? items : []).map((it) => (
                      <tr key={it.id}>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-zinc-900">{String(it.epcCode || '')}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-800">{it.runningNo == null ? '-' : String(it.runningNo)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-800">{it.netWeight == null ? '-' : String(it.netWeight)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-800">{it.caiqNumber == null ? '-' : String(it.caiqNumber)}</td>
                      </tr>
                    ))}
                    {(!items || items.length === 0) && !loading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                          {t('noEpc')}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-zinc-500">
                  {t('total', { value: Number(itemTotal) || 0 })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                    disabled={loading || itemsOffset <= 0}
                    onClick={async () => {
                      const nextOffset = Math.max(0, itemsOffset - itemsLimit);
                      setItemsOffset(nextOffset);
                      await fetchItems({ batchId: itemsBatch.id, limit: itemsLimit, offset: nextOffset });
                    }}
                  >
                    {t('prev')}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                    disabled={loading || itemsOffset + itemsLimit >= (Number(itemTotal) || 0)}
                    onClick={async () => {
                      const nextOffset = itemsOffset + itemsLimit;
                      setItemsOffset(nextOffset);
                      await fetchItems({ batchId: itemsBatch.id, limit: itemsLimit, offset: nextOffset });
                    }}
                  >
                    {t('next')}
                  </button>
                </div>
              </div>
            </div>
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
