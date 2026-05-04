import React from 'react';

export default function EpcBatchesPanel({
  t,
  batches,
  batchTotal,
  loading,
  batchQuery,
  setBatchQuery,
  formatDate,
  onSearch,
  onViewEpc,
  onViewCertificate,
  onExport
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={batchQuery} onChange={(e) => setBatchQuery(e.target.value)} placeholder={t('searchBatches')} className="ac-input" />
        <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={onSearch}>
          {t('inquire')}
        </button>
        <div className="ml-auto text-xs text-zinc-600">{t('total', { value: batchTotal })}</div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[160px_1fr_1fr_110px_160px_160px] gap-4 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
            <div>{t('corpCode')}</div>
            <div>{t('product')}</div>
            <div>{t('batchName')}</div>
            <div>{t('batchQty')}</div>
            <div>{t('createdAt')}</div>
            <div className="text-right">{t('actions')}</div>
          </div>

          {batches.map((b) => (
            <div key={b.id} className="grid grid-cols-[160px_1fr_1fr_110px_160px_160px] gap-4 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-800">
              <div className="font-mono text-xs">{b.corpPrefix}</div>
              <div>
                <div className="font-medium text-zinc-900">{b.product?.name}</div>
                <div className="text-[11px] text-zinc-500">{b.sku}</div>
              </div>
              <div className="text-sm">{b.batchName}</div>
              <div className="text-sm">{b.batchQty}</div>
              <div className="text-xs text-zinc-600">{formatDate(b.createdAt)}</div>
              <div className="flex justify-end gap-2">
                <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => onViewEpc(b.id)}>
                  {t('viewEpc')}
                </button>
                {typeof onViewCertificate === 'function' ? (
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                    disabled={!b.certificateId}
                    onClick={() => onViewCertificate(b.certificateId)}
                  >
                    {t('viewCertificate')}
                  </button>
                ) : null}
                <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => onExport?.(b.id)}>
                  {t('exportXlsx')}
                </button>
              </div>
            </div>
          ))}

          {!loading && batches.length === 0 ? <div className="p-6 text-center text-sm text-zinc-600">{t('noBatches')}</div> : null}
        </div>
      </div>
    </div>
  );
}
