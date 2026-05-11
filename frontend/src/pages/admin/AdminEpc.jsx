import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useEpcStore from '../../store/useEpcStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import { tRaw } from '../../i18n/tRaw';
import DataTable from '../../components/ui/DataTable';
import { hasPermission } from '../../utils/permissions';

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
    reader.onerror = () => reject(new Error(tRaw('failedToReadFile')));
    reader.readAsDataURL(file);
  });
}

export default function AdminEpc() {
  const { t } = useT();
  const navigate = useNavigate();
  const { user } = useAdminAuthStore((s) => ({ user: s.user }));
  const role = user?.role || 'admin';
  const perms = useMemo(() => (Array.isArray(user?.permissions) ? user.permissions : []), [user?.permissions]);
  const allow = useCallback(
    (...keys) =>
      role === 'super_admin' || hasPermission(perms, '*') || keys.some((k) => (k ? hasPermission(perms, k) : false)),
    [perms, role]
  );
  const canBatchCreate = allow('epc.write', 'epc.batch.create');
  const canBatchView = allow('epc.read', 'epc.write', 'epc.batch.view', 'epc.scan.access', 'epc.production.access');
  const canScan = allow('epc.write', 'epc.scan.access');
  const canViewCertificate = allow('epc.read', 'epc.write', 'epc.certificate.view');
  const canExportXlsx = allow('epc.write', 'epc.export.xlsx', 'epc.production.access');
  const canEncoding = allow('epc.write', 'epc.encoding');
  const canDelete = allow('epc.write', 'epc.delete');
  const canProduction = allow('epc.write', 'epc.production.access');
  const canOverride = role === 'super_admin' || role === 'admin' || allow('epc.override');

  const {
    corpCodes,
    batches,
    items,
    itemTotal,
    loading,
    error,
    fetchCorpCodes,
    fetchBatches,
    fetchItems,
    generateBatch,
    exportBatchXlsx,
    exportBatchVerifyUrlXlsx,
    importProductionXlsx,
    markProductionDone,
    deleteBatch,
    deleteAllBatches,
    exportBatchXlsxCustom
  } = useEpcStore((s) => ({
    corpCodes: s.corpCodes,
    batches: s.batches,
    items: s.items,
    itemTotal: s.itemTotal,
    loading: s.loading,
    error: s.error,
    fetchCorpCodes: s.fetchCorpCodes,
    fetchBatches: s.fetchBatches,
    fetchItems: s.fetchItems,
    generateBatch: s.generateBatch,
    exportBatchXlsx: s.exportBatchXlsx,
    exportBatchVerifyUrlXlsx: s.exportBatchVerifyUrlXlsx,
    exportBatchXlsxCustom: s.exportBatchXlsxCustom,
    importProductionXlsx: s.importProductionXlsx,
    markProductionDone: s.markProductionDone,
    deleteBatch: s.deleteBatch,
    deleteAllBatches: s.deleteAllBatches
  }));

  const [tab, setTab] = useState('batches');

  const [corpPrefix, setCorpPrefix] = useState('DA01');
  const [batchQty, setBatchQty] = useState(1);
  const [remark, setRemark] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsBatch, setItemsBatch] = useState(null);
  const [itemsOffset, setItemsOffset] = useState(0);
  const itemsLimit = 20;

  const [exportColsOpen, setExportColsOpen] = useState(false);
  const [exportColsBatch, setExportColsBatch] = useState(null);
  const [exportCols, setExportCols] = useState({
    epcCode: true,
    runningNo: false,
    netWeight: true,
    productionDate: true,
    caiqNumber: true
  });

  const closeItems = useCallback(() => {
    setItemsOpen(false);
    setItemsBatch(null);
  }, []);

  const closeExportCols = useCallback(() => {
    setExportColsOpen(false);
    setExportColsBatch(null);
  }, []);

  const openExportCols = useCallback((b) => {
    setExportColsBatch(b || null);
    setExportCols({
      epcCode: true,
      runningNo: false,
      netWeight: true,
      productionDate: true,
      caiqNumber: true
    });
    setExportColsOpen(true);
  }, []);

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
    if (!canBatchCreate && !canBatchView && !canProduction) return;
    void fetchCorpCodes();
    void fetchBatches({ limit: 50, offset: 0 });
  }, [canBatchCreate, canBatchView, canProduction, fetchBatches, fetchCorpCodes]);

  useEffect(() => {
    if (tab === 'batches' && canBatchView) return;
    if (tab === 'production' && canProduction) return;
    if (canBatchView) setTab('batches');
    else if (canProduction) setTab('production');
  }, [canBatchView, canProduction, tab]);

  const openBatchItems = async (b) => {
    if (!b?.id) return;
    setItemsBatch(b);
    setItemsOffset(0);
    setItemsOpen(true);
    await fetchItems({ batchId: b.id, limit: itemsLimit, offset: 0 });
  };

  useEffect(() => {
    if (!itemsOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeItems();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeItems, itemsOpen]);
  useEffect(() => {
    if (!Array.isArray(corpCodes) || corpCodes.length === 0) return;
    if (corpCodes.includes(corpPrefix)) return;
    setCorpPrefix(String(corpCodes[0] || '').trim() || 'DA01');
  }, [corpCodes, corpPrefix]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-zinc-900">{t('epc')}</div>
          <div className="mt-1 text-sm text-zinc-600">{t('guideStepBatchesBody')}</div>
        </div>
        <div className="flex items-center gap-2">
          {canBatchView ? (
            <button
              type="button"
              onClick={() => setTab('batches')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                tab === 'batches' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {t('epcBatches')}
            </button>
          ) : null}
          {canProduction ? (
            <button
              type="button"
              onClick={() => setTab('production')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                tab === 'production' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {t('productionOrders')}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      {!canBatchCreate && !canBatchView && !canProduction ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">Insufficient permissions</div>
      ) : null}

      {tab === 'batches' && canBatchView ? (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-xs font-semibold text-zinc-600">{t('epcBatches')}</div>
            <div className="flex items-center gap-2">
              {canBatchCreate ? (
                <button type="button" className="ac-btn ac-btn-primary px-3 py-2 text-xs" onClick={() => setGenerateOpen(true)}>
                  {t('generate')}
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  disabled={loading}
                  onClick={async () => {
                    if (!window.confirm(t('confirmDeleteAllEpc'))) return;
                    const res = await deleteAllBatches({ corpPrefix });
                    if (res) {
                      await fetchBatches({ limit: 50, offset: 0 });
                    }
                  }}
                >
                  {t('deleteAll')}
                </button>
              ) : null}
            </div>
          </div>
          <div className="p-4">
            <DataTable
              density="compact"
              minWidth={980}
              rows={Array.isArray(batches) ? batches : []}
              rowKey={(b) => b.id}
              loading={loading}
              emptyContent={t('noBatches')}
              columns={[
                {
                  id: 'batch',
                  header: 'Batch',
                  cell: (b) => <span className="whitespace-nowrap font-mono text-[11px] text-zinc-900">{String(b.batchName || '')}</span>
                },
                {
                  id: 'qty',
                  header: 'Qty Generated',
                  align: 'right',
                  cell: (b) => <span className="whitespace-nowrap text-zinc-800">{Number(b.batchQty) || 0}</span>
                },
                {
                  id: 'activated',
                  header: 'Qty Activated',
                  align: 'right',
                  cell: (b) => <span className="whitespace-nowrap text-zinc-800">{Number(b.activeCount) || 0}</span>
                },
                {
                  id: 'inactive',
                  header: 'Qty Inactive',
                  align: 'right',
                  cell: (b) => <span className="whitespace-nowrap text-zinc-800">{Number(b.inactiveCount) || 0}</span>
                },
                {
                  id: 'createdAt',
                  header: t('createdAt'),
                  cell: (b) => <span className="whitespace-nowrap text-zinc-700">{formatDateTime(b.createdAt)}</span>
                },
                {
                  id: 'actions',
                  header: '',
                  align: 'right',
                  headerClassName: 'pr-3',
                  className: 'pr-3',
                  cell: (b) => (
                    <div className="flex justify-end gap-2">
                      <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => openBatchItems(b)}>
                        {t('viewEpc')}
                      </button>
                      {canScan ? (
                        <button
                          type="button"
                          className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                          disabled={!b?.id}
                          onClick={() => navigate(`/admin/epc/scan?batchId=${encodeURIComponent(String(b.id))}`)}
                        >
                          {t('scanInput')}
                        </button>
                      ) : null}
                      {canExportXlsx ? (
                        <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => openExportCols(b)}>
                          {t('exportXlsx')}
                        </button>
                      ) : null}
                      {canDelete ? (
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
                      ) : null}
                    </div>
                  )
                }
              ]}
            />
          </div>
        </div>
      ) : null}

      {itemsOpen && itemsBatch ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={closeItems}
        >
          <div
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {t('epcItems')}: {itemsBatch.batchName}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {itemsBatch.product?.name || '-'} • {t('certificateId')}: {itemsBatch.certificateId ? <span className="font-mono">{String(itemsBatch.certificateId)}</span> : '-'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEncoding ? (
                  <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => exportBatchVerifyUrlXlsx(itemsBatch.id)}>
                    {t('exportVerifyUrlXlsx')}
                  </button>
                ) : null}
                <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeItems}>
                  {t('close')}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-4">
              <div className="h-full overflow-auto">
                <DataTable
                  density="compact"
                  containerClassName="rounded-lg border border-zinc-200 shadow-none"
                  minWidth={720}
                  rows={Array.isArray(items) ? items : []}
                  rowKey={(it) => it.id}
                  loading={loading}
                  loadingContent={t('loading')}
                  emptyContent={t('noEpc')}
                  columns={[
                    {
                      id: 'epc',
                      header: t('epcCode'),
                      cell: (it) => <span className="whitespace-nowrap font-mono text-[11px] text-zinc-900">{String(it.epcCode || '')}</span>
                    },
                    {
                      id: 'runningNo',
                      header: t('runningNo'),
                      cell: (it) => <span className="whitespace-nowrap text-zinc-800">{it.runningNo == null ? '-' : String(it.runningNo)}</span>
                    },
                    {
                      id: 'netWeight',
                      header: t('netWeight'),
                      cell: (it) => <span className="whitespace-nowrap text-zinc-800">{it.netWeight == null ? '-' : String(it.netWeight)}</span>
                    },
                    {
                      id: 'caiqNumber',
                      header: t('caiqNumber'),
                      cell: (it) => <span className="whitespace-nowrap text-zinc-800">{it.caiqNumber == null ? '-' : String(it.caiqNumber)}</span>
                    }
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-3">
              <div className="text-[11px] text-zinc-500">
                {t('total', { value: Number(itemTotal) || 0 })}{' '}
                <span className="text-zinc-400">
                  • Page {Math.floor(itemsOffset / itemsLimit) + 1} / {Math.max(1, Math.ceil((Number(itemTotal) || 0) / itemsLimit))}
                </span>
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
      ) : null}

      {exportColsOpen && exportColsBatch ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={closeExportCols}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{t('exportColumnsTitle')}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {exportColsBatch.batchName} • {exportColsBatch.product?.name || '-'} • {t('batchQty')}: {exportColsBatch.batchQty}
                </div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeExportCols}>
                {t('close')}
              </button>
            </div>

            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() =>
                    setExportCols({
                      epcCode: true,
                      runningNo: true,
                      netWeight: true,
                      productionDate: true,
                      caiqNumber: true
                    })
                  }
                >
                  {t('select')}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() =>
                    setExportCols({
                      epcCode: false,
                      runningNo: false,
                      netWeight: false,
                      productionDate: false,
                      caiqNumber: false
                    })
                  }
                >
                  {t('clear')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input
                    type="checkbox"
                    checked={Boolean(exportCols.epcCode)}
                    onChange={(e) => setExportCols((prev) => ({ ...prev, epcCode: e.target.checked }))}
                  />
                  {t('epcCode')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input
                    type="checkbox"
                    checked={Boolean(exportCols.runningNo)}
                    onChange={(e) => setExportCols((prev) => ({ ...prev, runningNo: e.target.checked }))}
                  />
                  {t('runningNo')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input
                    type="checkbox"
                    checked={Boolean(exportCols.netWeight)}
                    onChange={(e) => setExportCols((prev) => ({ ...prev, netWeight: e.target.checked }))}
                  />
                  {t('netWeight')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input
                    type="checkbox"
                    checked={Boolean(exportCols.productionDate)}
                    onChange={(e) => setExportCols((prev) => ({ ...prev, productionDate: e.target.checked }))}
                  />
                  {t('productionDate')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input
                    type="checkbox"
                    checked={Boolean(exportCols.caiqNumber)}
                    onChange={(e) => setExportCols((prev) => ({ ...prev, caiqNumber: e.target.checked }))}
                  />
                  {t('caiqNumber')}
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeExportCols}>
                {t('close')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={
                  loading ||
                  !exportColsBatch?.id ||
                  Object.values(exportCols || {}).filter(Boolean).length === 0
                }
                onClick={async () => {
                  const cols = ['epcCode', 'runningNo', 'netWeight', 'productionDate', 'caiqNumber'].filter((k) => Boolean(exportCols?.[k]));
                  const ok = await exportBatchXlsxCustom({ batchId: exportColsBatch.id, columns: cols });
                  if (ok) closeExportCols();
                }}
              >
                {t('exportXlsx')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'production' && canProduction ? (
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
                      {b.batchName}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {uploaded ? t('uploadedAt', { value: formatDateTime(b.productionUploadedAt) }) : t('notUploaded')} •{' '}
                      {done ? t('doneAt', { value: formatDateTime(b.productionDoneAt) }) : t('notDone')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canExportXlsx ? (
                      <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => openExportCols(b)}>
                        {t('exportXlsx')}
                      </button>
                    ) : null}
                    {canEncoding ? (
                      <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => exportBatchVerifyUrlXlsx(b.id)}>
                        {t('exportVerifyUrlXlsx')}
                      </button>
                    ) : null}
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

      {tab === 'production' && canProduction && canBatchCreate ? (
        null
      ) : null}

      {generateOpen ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
            <div className="mb-3 text-sm font-semibold text-zinc-900">{t('generate')} EPC</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('corpCode')}</div>
                <select value={corpPrefix} onChange={(e) => setCorpPrefix(e.target.value)} className="ac-input px-3 py-2 text-xs">
                  {(Array.isArray(corpCodes) ? corpCodes : [corpPrefix]).map((c) => (
                    <option key={c} value={String(c)}>
                      {String(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('batchQty')}</div>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={batchQty}
                  onChange={(e) => setBatchQty(Math.min(5000, Math.max(1, Number(e.target.value) || 1)))}
                  className="ac-input px-3 py-2 text-xs"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('remark')}</div>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-zinc-400"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setGenerateOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={loading || !String(corpPrefix || '').trim() || !batchQty}
                onClick={async () => {
                  await generateBatch({ corpPrefix: String(corpPrefix).trim(), batchQty, remark: String(remark || '').trim() || undefined });
                  setGenerateOpen(false);
                  setBatchQty(1);
                  setRemark('');
                  await fetchBatches({ limit: 50, offset: 0 });
                }}
              >
                {loading ? t('generating') : t('generate')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
