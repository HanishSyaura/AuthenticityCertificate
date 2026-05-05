import React from 'react';
import DataTable from '../../ui/DataTable';
import RowActionsMenu from '../../ui/RowActionsMenu';

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

      <DataTable
        minWidth={880}
        rows={batches}
        rowKey={(b) => b.id}
        loading={loading}
        loadingContent={t('loading')}
        emptyContent={t('noBatches')}
        columns={[
          { id: 'corp', header: t('corpCode'), cell: (b) => <span className="font-mono text-xs">{b.corpPrefix}</span> },
          {
            id: 'product',
            header: t('product'),
            cell: (b) => (
              <div>
                <div className="font-medium text-zinc-900">{b.product?.name}</div>
                <div className="text-[11px] text-zinc-500">{b.sku}</div>
              </div>
            )
          },
          { id: 'batchName', header: t('batchName'), cell: (b) => <span className="text-sm">{b.batchName}</span> },
          { id: 'qty', header: t('batchQty'), cell: (b) => <span className="text-sm">{b.batchQty}</span> },
          { id: 'createdAt', header: t('createdAt'), cell: (b) => <span className="text-xs text-zinc-600">{formatDate(b.createdAt)}</span> },
          {
            id: 'actions',
            header: t('actions'),
            align: 'right',
            cell: (b) => (
              <RowActionsMenu
                ariaLabel={t('actions')}
                items={[
                  { key: 'viewEpc', label: t('viewEpc'), onSelect: () => onViewEpc(b.id) },
                  typeof onViewCertificate === 'function'
                    ? { key: 'viewCert', label: t('viewCertificate'), disabled: !b.certificateId, onSelect: () => onViewCertificate(b.certificateId) }
                    : null,
                  { key: 'export', label: t('exportXlsx'), onSelect: () => onExport?.(b.id) }
                ].filter(Boolean)}
              />
            ),
            headerClassName: 'pr-3',
            className: 'pr-3'
          }
        ]}
      />
    </div>
  );
}
