import React from 'react';
import DataTable from '../../ui/DataTable';

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

      <DataTable
        minWidth={980}
        rows={items}
        rowKey={(it) => it.id}
        loading={loading}
        loadingContent={t('loading')}
        emptyContent={t('noEpc')}
        columns={[
          { id: 'epcCode', header: t('epcCode'), cell: (it) => <span className="font-mono text-xs">{it.epcCode}</span> },
          { id: 'batchName', header: t('batchName'), cell: (it) => <span className="text-sm">{it.batch?.batchName || '-'}</span> },
          {
            id: 'product',
            header: t('product'),
            cell: (it) => (
              <div>
                <div className="font-medium text-zinc-900">{it.batch?.product?.name || '-'}</div>
                <div className="text-[11px] text-zinc-500">{it.batch?.sku || '-'}</div>
              </div>
            )
          },
          { id: 'createdAt', header: t('createdAt'), cell: (it) => <span className="text-xs text-zinc-600">{formatDate(it.createdAt)}</span> }
        ]}
      />
    </div>
  );
}
