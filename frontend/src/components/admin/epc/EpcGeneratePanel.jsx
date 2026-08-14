import React, { useEffect, useMemo } from 'react';

export default function EpcGeneratePanel({
  t,
  corpCodes,
  corpPrefix,
  setCorpPrefix,
  products,
  productId,
  setProductId,
  batchName,
  setBatchName,
  batchQty,
  setBatchQty,
  remark,
  setRemark,
  loading,
  lastGenerated,
  onGenerate,
  onClear
}) {
  useEffect(() => {
    if (!corpPrefix && Array.isArray(corpCodes) && corpCodes.length > 0) setCorpPrefix(corpCodes[0]);
  }, [corpCodes, corpPrefix, setCorpPrefix]);

  const productOptions = useMemo(() => {
    return (Array.isArray(products) ? products : []).slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }, [products]);

  const latest = lastGenerated?.batch || null;

  return (
    <div className="ac-card p-5">
      <div className="mb-4 text-sm font-semibold text-zinc-900">{t('generateEpc')}</div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-zinc-600">{t('corpCode')}</div>
          <input
            value={corpPrefix}
            onChange={(e) => setCorpPrefix(e.target.value)}
            className="ac-input"
            placeholder="e.g. DA01"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-zinc-600">{t('product')}</div>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="ac-input">
            <option value="">{t('selectProduct')}</option>
            {productOptions.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} ({p.sku})
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
          <input
            type="number"
            min={1}
            max={5000}
            value={batchQty}
            onChange={(e) => setBatchQty(Number(e.target.value) || 1)}
            className="ac-input"
          />
          <div className="mt-1 text-[11px] text-zinc-500">{t('batchQtyHint')}</div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-zinc-600">{t('remark')}</div>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="h-24 w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={onClear}>
          {t('clear')}
        </button>
        <button type="button" className="ac-btn ac-btn-primary px-3 py-2 text-xs" disabled={loading} onClick={onGenerate}>
          {loading ? t('generating') : t('generate')}
        </button>
      </div>

      {latest ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-semibold text-emerald-900">{t('latestBatch')}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-emerald-900">
            <div>
              <div className="text-emerald-700">{t('corpCode')}</div>
              <div className="font-mono">{latest.corpPrefix}</div>
            </div>
            <div>
              <div className="text-emerald-700">{t('batchQty')}</div>
              <div>{latest.batchQty}</div>
            </div>
            <div className="col-span-2">
              <div className="text-emerald-700">{t('product')}</div>
              <div>
                {latest.product?.name} ({latest.sku})
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-emerald-700">{t('batchName')}</div>
              <div>{latest.batchName}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
