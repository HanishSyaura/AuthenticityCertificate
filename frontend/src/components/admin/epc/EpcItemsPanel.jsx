import React from 'react';

export default function EpcItemsPanel({
  t,
  items,
  itemTotal,
  loading,
  itemQuery,
  setItemQuery,
  selectedBatchId,
  setSelectedBatchId,
  batches,
  formatDate,
  onSearch
}) {
  return (
    <div>
      <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_240px_auto]">
        <input value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder={t('searchEpc')} className="ac-input" />
        <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="ac-input">
          <option value="">{t('allBatches')}</option>
          {batches.slice(0, 50).map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.batchName} ({b.corpPrefix})
            </option>
          ))}
        </select>
        <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={onSearch}>
          {t('inquire')}
        </button>
      </div>

      <div className="mb-3 text-xs text-zinc-600">{t('total', { value: itemTotal })}</div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[240px_1fr_1fr_160px] gap-4 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
            <div>{t('epcCode')}</div>
            <div>{t('batchName')}</div>
            <div>{t('product')}</div>
            <div>{t('createdAt')}</div>
          </div>

          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-[240px_1fr_1fr_160px] gap-4 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-800">
              <div className="font-mono text-xs">{it.epcCode}</div>
              <div className="text-sm">{it.batch?.batchName || '-'}</div>
              <div>
                <div className="font-medium text-zinc-900">{it.batch?.product?.name || '-'}</div>
                <div className="text-[11px] text-zinc-500">{it.batch?.sku || '-'}</div>
              </div>
              <div className="text-xs text-zinc-600">{formatDate(it.createdAt)}</div>
            </div>
          ))}

          {!loading && items.length === 0 ? <div className="p-6 text-center text-sm text-zinc-600">{t('noEpc')}</div> : null}
        </div>
      </div>
    </div>
  );
}

