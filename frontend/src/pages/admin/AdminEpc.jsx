import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useEpcStore from '../../store/useEpcStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useRecordsStore from '../../store/useRecordsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useUploadsStore from '../../store/useUploadsStore';
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
  const canExportXlsx = allow('epc.write', 'epc.export.xlsx', 'epc.production.access');
  const canEncoding = allow('epc.write', 'epc.encoding');
  const canDelete = useMemo(() => {
    if (role === 'super_admin' || hasPermission(perms, '*')) return true;
    return hasPermission(perms, 'epc.delete') && hasPermission(perms, 'epc.cleanup.delete');
  }, [perms, role]);
  const canClearGenerated = useMemo(() => {
    if (role === 'super_admin' || hasPermission(perms, '*')) return true;
    return hasPermission(perms, 'epc.delete') && hasPermission(perms, 'epc.cleanup.delete_all_generated');
  }, [perms, role]);
  const canProduction = allow('epc.write', 'epc.production.access');
  const canBatchImport = allow('epc.write', 'epc.production.access');

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
    exportBatchVerifyUrlXlsx,
    exportBatchProductionTemplateXlsx,
    exportBatchImportTemplateXlsx,
    importProductionXlsx,
    previewBatchImportXlsx,
    submitBatchImport,
    markProductionDone,
    exportBatchXlsxCustom,
    exportItemsXlsx,
    deleteItems,
    deleteAllGeneratedBatches
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
    exportBatchVerifyUrlXlsx: s.exportBatchVerifyUrlXlsx,
    exportBatchProductionTemplateXlsx: s.exportBatchProductionTemplateXlsx,
    exportBatchImportTemplateXlsx: s.exportBatchImportTemplateXlsx,
    exportBatchXlsxCustom: s.exportBatchXlsxCustom,
    importProductionXlsx: s.importProductionXlsx,
    previewBatchImportXlsx: s.previewBatchImportXlsx,
    submitBatchImport: s.submitBatchImport,
    markProductionDone: s.markProductionDone,
    exportItemsXlsx: s.exportItemsXlsx,
    deleteItems: s.deleteItems,
    deleteAllGeneratedBatches: s.deleteAllGeneratedBatches
  }));

  const { products, fetchProducts } = useRecordsStore((s) => ({ products: s.products, fetchProducts: s.fetchProducts }));
  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({ templates: s.templates, fetchTemplates: s.fetchTemplates }));
  const { uploadMedia } = useUploadsStore((s) => ({ uploadMedia: s.uploadMedia }));

  const [tab, setTab] = useState('batches');

  const authTemplates = useMemo(() => (Array.isArray(templates) ? templates : []).filter((tpl) => String(tpl?.templateType || '').toLowerCase() === 'auth'), [templates]);

  const [batchQty, setBatchQty] = useState(1);
  const [remark, setRemark] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [listQuery, setListQuery] = useState('');
  const [listBatchId, setListBatchId] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [listOffset, setListOffset] = useState(0);
  const listLimit = 50;
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [exportItemColsOpen, setExportItemColsOpen] = useState(false);
  const [exportItemCols, setExportItemCols] = useState({
    epcCode: true,
    barcode: true,
    caiqNumber: true,
    netWeight: true,
    manufactureDate: true,
    batchNumber: true,
    swiftletHouseNumber: true,
    status: false,
    createdAt: false,
    remark: false
  });

  const [exportColsOpen, setExportColsOpen] = useState(false);
  const [exportColsBatch, setExportColsBatch] = useState(null);
  const [exportCols, setExportCols] = useState({
    epcCode: true,
    runningNo: false,
    netWeight: true,
    productionDate: true,
    caiqNumber: true
  });

  const DOC_TYPES = useMemo(
    () => [
      'moh_health_certificate',
      'export_permit',
      'dvs_health_certificate',
      'dvs_coo_certificate'
    ],
    []
  );

  const [importOpen, setImportOpen] = useState(false);
  const [importBatch, setImportBatch] = useState(null);
  const [importBase64, setImportBase64] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importProductId, setImportProductId] = useState('');
  const [importSku, setImportSku] = useState('');
  const [importAuthTemplateId, setImportAuthTemplateId] = useState('');
  const [importDocUrls, setImportDocUrls] = useState(() => ({
    moh_health_certificate: '',
    export_permit: '',
    dvs_health_certificate: '',
    dvs_coo_certificate: ''
  }));
  const [importDocUploading, setImportDocUploading] = useState(() => ({
    moh_health_certificate: false,
    export_permit: false,
    dvs_health_certificate: false,
    dvs_coo_certificate: false
  }));
  const [importLocalError, setImportLocalError] = useState('');
  const [viewBatchOpen, setViewBatchOpen] = useState(false);
  const [viewBatch, setViewBatch] = useState(null);

  const getDocTypeLabel = useCallback(
    (docType) =>
      docType === 'moh_health_certificate'
        ? t('mohHealthCertificate')
        : docType === 'export_permit'
          ? t('exportPermit')
          : docType === 'dvs_health_certificate'
            ? t('dvsHealthCertificate')
            : docType === 'dvs_coo_certificate'
              ? t('dvsCooCertificate')
              : String(docType || '-'),
    [t]
  );

  const closeExportCols = useCallback(() => {
    setExportColsOpen(false);
    setExportColsBatch(null);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailItem(null);
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

  const closeImport = useCallback(() => {
    setImportOpen(false);
    setImportBatch(null);
    setImportBase64('');
    setImportPreview(null);
    setImportProductId('');
    setImportSku('');
    setImportAuthTemplateId('');
    setImportDocUrls({
      moh_health_certificate: '',
      export_permit: '',
      dvs_health_certificate: '',
      dvs_coo_certificate: ''
    });
    setImportDocUploading({
      moh_health_certificate: false,
      export_permit: false,
      dvs_health_certificate: false,
      dvs_coo_certificate: false
    });
    setImportLocalError('');
  }, []);

  const closeViewBatch = useCallback(() => {
    setViewBatchOpen(false);
    setViewBatch(null);
  }, []);

  const openViewBatch = useCallback((b) => {
    if (!b) return;
    setViewBatch(b);
    setViewBatchOpen(true);
  }, []);

  const openImport = useCallback(
    (b) => {
      const batch = b || null;
      setImportBatch(batch);
      setImportOpen(true);
      setImportBase64('');
      setImportPreview(null);
      setImportLocalError('');
    },
    []
  );

  useEffect(() => {
    if (!canBatchCreate && !canBatchView && !canBatchImport && !canProduction) return;
    void fetchCorpCodes();
  }, [canBatchCreate, canBatchImport, canBatchView, canProduction, fetchBatches, fetchCorpCodes]);

  useEffect(() => {
    if (tab === 'import' && canBatchImport) {
      void fetchBatches({ origin: 'import', limit: 50, offset: 0 });
    } else if (tab === 'production' && canProduction) {
      void fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
    }
  }, [canBatchImport, canProduction, fetchBatches, tab]);

  useEffect(() => {
    if (tab === 'batches' && canBatchView) return;
    if (tab === 'import' && canBatchImport) return;
    if (tab === 'production' && canProduction) return;
    if (canBatchView) setTab('batches');
    else if (canBatchImport) setTab('import');
    else if (canProduction) setTab('production');
  }, [canBatchImport, canBatchView, canProduction, tab]);

  useEffect(() => {
    if (tab !== 'batches' || !canBatchView) return;
    void fetchItems({
      q: listQuery,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      batchId: listBatchId || undefined,
      limit: listLimit,
      offset: listOffset
    });
  }, [canBatchView, createdFrom, createdTo, fetchItems, listBatchId, listLimit, listOffset, listQuery, tab]);

  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [items, listOffset, listQuery, listBatchId, createdFrom, createdTo]);

  const pageItemIds = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .map((it) => Number(it?.id))
        .filter((n) => Number.isFinite(n) && n > 0),
    [items]
  );
  const allPageSelected = useMemo(() => pageItemIds.length > 0 && pageItemIds.every((id) => selectedItemIds.has(id)), [pageItemIds, selectedItemIds]);

  return (
    <div className="p-4 sm:p-6 lg:p-8" data-tour="epc-page">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div data-tour="epc-header">
          <div className="text-base font-semibold text-zinc-900">{t('epc')}</div>
          <div className="mt-1 text-sm text-zinc-600">{t('guideStepBatchesBody')}</div>
        </div>
        <div className="flex items-center gap-2" data-tour="epc-tabs">
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
          {canBatchImport ? (
            <button
              type="button"
              onClick={() => setTab('import')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                tab === 'import' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {t('batchImport')}
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

      {!canBatchCreate && !canBatchView && !canBatchImport && !canProduction ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">Insufficient permissions</div>
      ) : null}

      {tab === 'batches' && canBatchView ? (
        <div className="rounded-xl border border-zinc-200 bg-white" data-tour="epc-items-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-xs font-semibold text-zinc-600">{t('epcItems')}</div>
            <div className="flex flex-wrap items-center gap-2">
              {canScan ? (
                <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" data-tour="epc-scan" onClick={() => navigate('/admin/epc/scan')}>
                  {t('scanInput')}
                </button>
              ) : null}
              {canExportXlsx ? (
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={loading || (Number(itemTotal) || 0) === 0}
                  onClick={() => setExportItemColsOpen(true)}
                >
                  {t('exportXlsx')}
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={loading || selectedItemIds.size === 0}
                  onClick={async () => {
                    if (!window.confirm(t('confirmDeleteEpcCleanup'))) return;
                    const res = await deleteItems({ itemIds: Array.from(selectedItemIds), cleanup: true });
                    if (!res) return;
                    setSelectedItemIds(new Set());
                    setListOffset(0);
                    await fetchItems({
                      q: listQuery,
                      createdFrom: createdFrom || undefined,
                      createdTo: createdTo || undefined,
                      batchId: listBatchId || undefined,
                      limit: listLimit,
                      offset: 0
                    });
                  }}
                >
                  {t('delete')}
                </button>
              ) : null}
              {canClearGenerated ? (
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs text-rose-700"
                  disabled={loading}
                  onClick={async () => {
                    if (!window.confirm(t('confirmClearAllGeneratedEpc'))) return;
                    const res = await deleteAllGeneratedBatches({});
                    if (!res) return;
                    setSelectedItemIds(new Set());
                    setListOffset(0);
                    await fetchItems({
                      q: listQuery,
                      createdFrom: createdFrom || undefined,
                      createdTo: createdTo || undefined,
                      batchId: listBatchId || undefined,
                      limit: listLimit,
                      offset: 0
                    });
                  }}
                >
                  {t('clearAllGeneratedEpc')}
                </button>
              ) : null}
              {canBatchCreate ? (
                <button type="button" className="ac-btn ac-btn-primary px-3 py-2 text-xs" data-tour="epc-generate" onClick={() => setGenerateOpen(true)}>
                  {t('generate')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_240px_240px_180px_auto]">
              <div className="flex flex-col gap-1">
                <label htmlFor="searchEpcCode" className="text-[11px] text-zinc-500">
                  {t('searchEpcCode')}
                </label>
                <input
                  id="searchEpcCode"
                  value={listQuery}
                  onChange={(e) => {
                    setListQuery(e.target.value);
                    setListOffset(0);
                  }}
                  placeholder={t('searchEpc')}
                  className="ac-input"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="createdFrom" className="text-[11px] text-zinc-500">
                  {t('createdFrom')}
                </label>
                <input
                  id="createdFrom"
                  type="datetime-local"
                  value={createdFrom}
                  onChange={(e) => {
                    setCreatedFrom(e.target.value);
                    setListOffset(0);
                  }}
                  className="ac-input"
                  placeholder={t('createdFrom')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="createdTo" className="text-[11px] text-zinc-500">
                  {t('createdTo')}
                </label>
                <input
                  id="createdTo"
                  type="datetime-local"
                  value={createdTo}
                  onChange={(e) => {
                    setCreatedTo(e.target.value);
                    setListOffset(0);
                  }}
                  className="ac-input"
                  placeholder={t('createdTo')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="batchId" className="text-[11px] text-zinc-500">
                  {t('batchId')}
                </label>
                <input
                  id="batchId"
                  inputMode="numeric"
                  value={listBatchId}
                  onChange={(e) => {
                    setListBatchId(e.target.value);
                    setListOffset(0);
                  }}
                  className="ac-input"
                  placeholder={t('allBatches')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div aria-hidden className="select-none text-[11px] text-transparent">
                  .
                </div>
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-4 py-3 text-sm"
                  onClick={() =>
                    fetchItems({
                      q: listQuery,
                      createdFrom: createdFrom || undefined,
                      createdTo: createdTo || undefined,
                      batchId: listBatchId || undefined,
                      limit: listLimit,
                      offset: 0
                    })
                  }
                >
                  {t('inquire')}
                </button>
              </div>
            </div>

            <div className="mb-2 text-[11px] text-zinc-500">
              {t('total', { value: Number(itemTotal) || 0 })}{' '}
              <span className="text-zinc-400">
                • Page {Math.floor(listOffset / listLimit) + 1} / {Math.max(1, Math.ceil((Number(itemTotal) || 0) / listLimit))}
                • {listBatchId ? `${t('batch')} #${String(listBatchId).trim()}` : t('allBatches')}
              </span>
            </div>

            <DataTable
              density="compact"
              minWidth={980}
              rows={Array.isArray(items) ? items : []}
              rowKey={(it) => it.id}
              loading={loading}
              emptyContent={t('noEpc')}
              columns={[
                {
                  id: 'select',
                  header: (
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={() => {
                        setSelectedItemIds((prev) => {
                          const next = new Set(prev);
                          if (allPageSelected) pageItemIds.forEach((id) => next.delete(id));
                          else pageItemIds.forEach((id) => next.add(id));
                          return next;
                        });
                      }}
                    />
                  ),
                  cell: (it) => {
                    const id = Number(it?.id);
                    const checked = Number.isFinite(id) && selectedItemIds.has(id);
                    return (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (!Number.isFinite(id)) return;
                          setSelectedItemIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          });
                        }}
                      />
                    );
                  }
                },
                {
                  id: 'epcCode',
                  header: t('epcCode'),
                  cell: (it) => (
                    <button
                      type="button"
                      className="font-mono text-[11px] text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
                      onClick={() => {
                        setDetailItem(it || null);
                        setDetailOpen(true);
                      }}
                    >
                      {String(it.epcCode || '')}
                    </button>
                  )
                },
                {
                  id: 'batch',
                  header: t('batch'),
                  cell: (it) => {
                    const b = it?.batch;
                    const id = b?.id != null ? String(b.id) : '';
                    const name = b?.batchName ? String(b.batchName) : '-';
                    const origin = b?.origin ? String(b.origin) : '';
                    return (
                      <button
                        type="button"
                        className="min-w-0 text-left text-xs text-zinc-800 hover:underline"
                        onClick={() => {
                          if (!id) return;
                          setListBatchId(id);
                          setListOffset(0);
                        }}
                      >
                        <div className="truncate">{name}</div>
                        <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {id ? `#${id}` : '-'}
                          {origin ? ` • ${origin}` : ''}
                        </div>
                      </button>
                    );
                  }
                },
                {
                  id: 'status',
                  header: t('status'),
                  cell: (it) => {
                    const s = String(it?.status || '').toUpperCase();
                    const active = s === 'ACTIVE';
                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-zinc-50 text-zinc-700 ring-1 ring-inset ring-zinc-200'
                        }`}
                      >
                        {active ? t('active') : t('inactive')}
                      </span>
                    );
                  }
                },
                { id: 'createdAt', header: t('createdAt'), cell: (it) => <span className="whitespace-nowrap text-zinc-700">{formatDateTime(it.createdAt)}</span> },
                { id: 'remark', header: t('remark'), cell: (it) => <span className="text-zinc-800">{it?.batch?.remark ? String(it.batch.remark) : '-'}</span> }
              ]}
            />

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                disabled={loading || listOffset <= 0}
                onClick={() => setListOffset((o) => Math.max(0, o - listLimit))}
              >
                {t('prev')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                disabled={loading || listOffset + listLimit >= (Number(itemTotal) || 0)}
                onClick={() => setListOffset((o) => o + listLimit)}
              >
                {t('next')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen && detailItem ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{t('epcDetails')}</div>
                <div className="mt-1 truncate font-mono text-[11px] text-zinc-600">{String(detailItem.epcCode || '')}</div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeDetail}>
                {t('close')}
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('epcCode')}</div>
                  <div className="mt-1 font-mono text-xs text-zinc-900">{String(detailItem.epcCode || '-')}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('barcode')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem.barcode ? String(detailItem.barcode) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('individualLabelCaiq')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem.caiqNumber ? String(detailItem.caiqNumber) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('netWeight')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem.netWeight ? String(detailItem.netWeight) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('manufactureDate')}</div>
                  <div className="mt-1 text-xs text-zinc-900">
                    {detailItem.productionDate ? new Date(detailItem.productionDate).toISOString().slice(0, 10) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('batchNumber')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem.batchNumber ? String(detailItem.batchNumber) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('batchId')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem?.batch?.id != null ? String(detailItem.batch.id) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('batchName')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem?.batch?.batchName ? String(detailItem.batch.batchName) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('origin')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem?.batch?.origin ? String(detailItem.batch.origin) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('remark')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{detailItem?.batch?.remark ? String(detailItem.batch.remark) : '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('swiftletHouseNumber')}</div>
                  <div className="mt-1 text-xs text-zinc-900">
                    {detailItem.swiftletHouseNumber ? String(detailItem.swiftletHouseNumber) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('createdAt')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{formatDateTime(detailItem.createdAt) || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {exportItemColsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setExportItemColsOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{t('exportColumnsTitleEpcList')}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{t('total', { value: Number(itemTotal) || 0 })}</div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setExportItemColsOpen(false)}>
                {t('close')}
              </button>
            </div>

            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() =>
                    setExportItemCols({
                      epcCode: true,
                      barcode: true,
                      caiqNumber: true,
                      netWeight: true,
                      manufactureDate: true,
                      batchNumber: true,
                      swiftletHouseNumber: true,
                      status: true,
                      createdAt: true,
                      remark: true
                    })
                  }
                >
                  {t('select')}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() =>
                    setExportItemCols({
                      epcCode: false,
                      barcode: false,
                      caiqNumber: false,
                      netWeight: false,
                      manufactureDate: false,
                      batchNumber: false,
                      swiftletHouseNumber: false,
                      status: false,
                      createdAt: false,
                      remark: false
                    })
                  }
                >
                  {t('clear')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.epcCode)} onChange={(e) => setExportItemCols((p) => ({ ...p, epcCode: e.target.checked }))} />
                  {t('epcCode')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.barcode)} onChange={(e) => setExportItemCols((p) => ({ ...p, barcode: e.target.checked }))} />
                  {t('barcode')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.caiqNumber)} onChange={(e) => setExportItemCols((p) => ({ ...p, caiqNumber: e.target.checked }))} />
                  {t('individualLabelCaiq')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.netWeight)} onChange={(e) => setExportItemCols((p) => ({ ...p, netWeight: e.target.checked }))} />
                  {t('netWeight')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.manufactureDate)} onChange={(e) => setExportItemCols((p) => ({ ...p, manufactureDate: e.target.checked }))} />
                  {t('manufactureDate')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.batchNumber)} onChange={(e) => setExportItemCols((p) => ({ ...p, batchNumber: e.target.checked }))} />
                  {t('batchNumber')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input
                    type="checkbox"
                    checked={Boolean(exportItemCols.swiftletHouseNumber)}
                    onChange={(e) => setExportItemCols((p) => ({ ...p, swiftletHouseNumber: e.target.checked }))}
                  />
                  {t('swiftletHouseNumber')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.status)} onChange={(e) => setExportItemCols((p) => ({ ...p, status: e.target.checked }))} />
                  {t('status')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.createdAt)} onChange={(e) => setExportItemCols((p) => ({ ...p, createdAt: e.target.checked }))} />
                  {t('createdAt')}
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-800">
                  <input type="checkbox" checked={Boolean(exportItemCols.remark)} onChange={(e) => setExportItemCols((p) => ({ ...p, remark: e.target.checked }))} />
                  {t('remark')}
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setExportItemColsOpen(false)}>
                {t('close')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={loading || (Number(itemTotal) || 0) === 0 || Object.values(exportItemCols || {}).filter(Boolean).length === 0}
                onClick={async () => {
                  const cols = [
                    'epcCode',
                    'barcode',
                    'caiqNumber',
                    'netWeight',
                    'manufactureDate',
                    'batchNumber',
                    'swiftletHouseNumber',
                    'status',
                    'createdAt',
                    'remark'
                  ].filter((k) => Boolean(exportItemCols?.[k]));
                  await exportItemsXlsx({
                    q: listQuery,
                    createdFrom: createdFrom || undefined,
                    createdTo: createdTo || undefined,
                    batchId: listBatchId || undefined,
                    columns: cols
                  });
                  setExportItemColsOpen(false);
                }}
              >
                {t('exportXlsx')}
              </button>
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

      {tab === 'import' && canBatchImport ? (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-xs font-semibold text-zinc-600">{t('batchImport')}</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="ac-btn ac-btn-primary px-3 py-2 text-xs" disabled={loading} onClick={() => openImport(null)}>
                {t('importBatchFile')}
              </button>
            </div>
          </div>
          <div className="px-4 py-6 text-sm text-zinc-700">
            Import XLSX untuk update data EPC yang sedia ada (contoh: net weight, CAIQ, barcode). EPC dalam fail mesti wujud dalam sistem.
          </div>
        </div>
      ) : null}

      {viewBatchOpen && viewBatch ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={closeViewBatch}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{t('batchInformation')}</div>
                <div className="mt-1 truncate text-xs text-zinc-500">{String(viewBatch?.batchName || '-')}</div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeViewBatch}>
                {t('close')}
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('batchId')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{String(viewBatch?.id || '-')}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('batchName')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{String(viewBatch?.batchName || '-')}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('uploadedAt')}</div>
                  <div className="mt-1 text-xs text-zinc-900">
                    {viewBatch?.productionUploadedAt ? formatDateTime(viewBatch.productionUploadedAt) : t('notUploaded')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('product')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{String(viewBatch?.product?.name || '-')}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('sku')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{String(viewBatch?.sku || viewBatch?.product?.sku || '-')}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-semibold text-zinc-600">{t('authCertificate')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{String(viewBatch?.certificateTemplate?.name || '-')}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-semibold text-zinc-600">{t('epcItems')}</div>
                  <div className="mt-2">
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                      onClick={() => {
                        setTab('batches');
                        setListQuery('');
                        setCreatedFrom('');
                        setCreatedTo('');
                        setListBatchId(String(viewBatch.id));
                        setListOffset(0);
                        closeViewBatch();
                      }}
                    >
                      {t('viewEpc')}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold text-zinc-600">{t('supportingCertificates')}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DOC_TYPES.map((docType) => {
                    const matching = (Array.isArray(viewBatch?.documents) ? viewBatch.documents : []).find((d) => String(d?.docType || '').trim() === docType);
                    const url = String(matching?.mediaUrl || '').trim();
                    return (
                      <div key={docType} className="rounded-xl border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-semibold text-zinc-900">{getDocTypeLabel(docType)}</div>
                        <div className="mt-2">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold underline">
                              {t('view')}
                            </a>
                          ) : (
                            <div className="text-[11px] text-zinc-500">{t('notUploaded')}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                          await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
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
                        await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
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

      {importOpen ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
            <div className="mb-3 text-sm font-semibold text-zinc-900">
              {t('importBatchFile')}
            </div>

            {importLocalError ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{importLocalError}</div> : null}

            <div className="space-y-4">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('uploadXlsx')}</div>
                <label className="ac-btn ac-btn-soft inline-flex px-3 py-2 text-xs">
                  {t('chooseFile')}
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={async (e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImportLocalError('');
                        setImportPreview(null);
                        const base64 = await toBase64(file);
                        setImportBase64(base64);
                        const preview = await previewBatchImportXlsx({ batchId: null, base64 });
                        setImportPreview(preview);
                      } catch (err) {
                        setImportPreview(null);
                        setImportBase64('');
                        setImportLocalError(err?.message || tRaw('operationFailed'));
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                {importPreview ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 sm:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600">Rows</div>
                      <div className="mt-0.5 font-mono">{String(importPreview.rows || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600">Unique EPC</div>
                      <div className="mt-0.5 font-mono">{String(importPreview.uniqueEpcs || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600">Missing EPC</div>
                      <div className="mt-0.5 font-mono">{String(importPreview.missingEpcs || 0)}</div>
                    </div>
                  </div>
                ) : null}
                {importPreview?.missingSample?.length ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Missing sample: {String(importPreview.missingSample.join(', '))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeImport}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={loading}
                onClick={async () => {
                  try {
                    setImportLocalError('');
                    if (!importBase64) throw new Error(t('uploadXlsxFirst'));
                    if (!importPreview) throw new Error(t('uploadXlsxFirst'));
                    const missingCount = Number(importPreview?.missingEpcs) || 0;
                    if (missingCount > 0) throw new Error('Some EPC codes do not exist in the system.');
                    await submitBatchImport({ batchId: null, base64: importBase64 });
                    closeImport();
                  } catch (err) {
                    setImportLocalError(err?.message || tRaw('operationFailed'));
                  }
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {generateOpen ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
            <div className="mb-3 text-sm font-semibold text-zinc-900">{t('generate')} EPC</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('corpCode')}</div>
                <input
                  value={String((Array.isArray(corpCodes) && corpCodes[0]) || 'DA01')}
                  readOnly
                  className="ac-input px-3 py-2 text-xs"
                />
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
                disabled={loading || !batchQty}
                onClick={async () => {
                  const created = await generateBatch({ batchQty, remark: String(remark || '').trim() || undefined });
                  const batchId = created?.batch?.id != null ? Number(created.batch.id) : null;
                  if (Number.isFinite(batchId)) {
                    await exportBatchProductionTemplateXlsx(batchId);
                  }
                  setGenerateOpen(false);
                  setBatchQty(1);
                  setRemark('');
                  setListOffset(0);
                  await fetchItems({
                    q: listQuery,
                    createdFrom: createdFrom || undefined,
                    createdTo: createdTo || undefined,
                    batchId: listBatchId || undefined,
                    limit: listLimit,
                    offset: 0
                  });
                  await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
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
