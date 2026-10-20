import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useEpcStore from '../../store/useEpcStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useRecordsStore from '../../store/useRecordsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useUploadsStore from '../../store/useUploadsStore';
import useCertificatesStore from '../../store/useCertificatesStore';
import useCmsStore from '../../store/useCmsStore';
import { useT } from '../../i18n/useT';
import { tRaw } from '../../i18n/tRaw';
import DataTable from '../../components/ui/DataTable';
import TablePager from '../../components/ui/TablePager';
import RowActionsMenu from '../../components/ui/RowActionsMenu';
import EpcDynamicFieldsPanel from '../../components/admin/epc/EpcDynamicFieldsPanel';
import EpcDynamicEntryGrid from '../../components/admin/epc/EpcDynamicEntryGrid';
import { hasPermission } from '../../utils/permissions';
import { resolvePublicMediaUrl } from '../../utils/apiBase';
import { sortRows } from '../../utils/tableSort';

function formatDateTime(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function formatNetWeight(value) {
  if (value === null || value === undefined) return '-';
  const s = String(value).trim();
  if (!s) return '-';
  if (/^\d+(\.\d+)?$/.test(s)) return `${s} g`;
  return s;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(tRaw('failedToReadFile')));
    reader.readAsDataURL(file);
  });
}

function toIsoDateInputValue(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toDdMmYyFromIso(input) {
  const value = String(input || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [yyyy, mm, dd] = value.split('-');
  return `${dd}${mm}${String(yyyy).slice(-2)}`;
}

const EPC_EXPORT_COLUMN_META = {
  epcCode: { labelKey: 'epcCode', defaultOn: true, alwaysOffer: true },
  runningNo: { labelKey: 'runningNo', defaultOn: false, alwaysOffer: true },
  status: { labelKey: 'status', defaultOn: false },
  createdAt: { labelKey: 'createdAt', defaultOn: false },
  remark: { labelKey: 'remark', defaultOn: false }
};

function resolveTemplateForBatch(batch, templatesList) {
  if (!batch) return null;
  const list = Array.isArray(templatesList) ? templatesList : [];
  const explicitTemplateId = batch?.certificateTemplateId ?? batch?.certificateTemplate?.id ?? null;
  const batchCertificateId = String(batch?.certificateId ?? '').trim();
  if (explicitTemplateId != null) {
    const idNum = Number(explicitTemplateId);
    if (Number.isFinite(idNum)) {
      const found = list.find((t) => Number(t?.id) === idNum) || null;
      if (found) return found;
    }
  }
  if (batchCertificateId) {
    const found = list.find((t) => String(t?.certificateId || '').trim() === batchCertificateId) || null;
    if (found) return found;
  }
  return null;
}

function deriveExportColumns(template, batch, activeFields, mode) {
  const placeholders = Array.isArray(template?.placeholders) ? template.placeholders : [];
  const detectedKeys = new Set();

  for (const p of placeholders) {
    const bindPath = String(p?.bindPath || '').trim();
    if (!bindPath) continue;
    if (bindPath.startsWith('epcItem.')) {
      const key = bindPath.slice('epcItem.'.length).trim();
      if (key) detectedKeys.add(key);
      continue;
    }
  }

  const snapshotFields = Array.isArray(batch?.fieldSchemaSnapshot) && batch.fieldSchemaSnapshot.length > 0 ? batch.fieldSchemaSnapshot : activeFields;
  const dynamicFields = (Array.isArray(snapshotFields) ? snapshotFields : [])
    .map((field) => ({
      key: String(field?.fieldKey || '').trim(),
      label: String(field?.label || field?.fieldKey || '').trim(),
      labelKey: String(field?.label || field?.fieldKey || '').trim(),
      isDynamic: true,
      defaultOn: true
    }))
    .filter((field) => field.key);

  const always = mode === 'batch' ? ['epcCode', 'runningNo'] : ['epcCode'];
  for (const k of always) detectedKeys.add(k);

  const meta = EPC_EXPORT_COLUMN_META;
  const out = [];
  const seen = new Set();

  for (const k of always) {
    if (seen.has(k)) continue;
    seen.add(k);
    const m = meta[k] || { labelKey: k, defaultOn: true };
    out.push({ key: k, labelKey: m.labelKey, defaultOn: !!m.defaultOn });
  }

  for (const k of detectedKeys) {
    if (seen.has(k)) continue;
    seen.add(k);
    const m = meta[k] || { labelKey: k, defaultOn: true };
    out.push({ key: k, labelKey: m.labelKey, defaultOn: !!m.defaultOn });
  }

  const offerRest = [];
  for (const [k, m] of Object.entries(meta)) {
    if (!m.alwaysOffer) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    offerRest.push({ key: k, labelKey: m.labelKey, defaultOn: !!m.defaultOn });
  }

  for (const extra of offerRest) out.push(extra);

  return [...out, ...dynamicFields];
}

function buildDefaultSelection(cols) {
  const sel = {};
  for (const c of Array.isArray(cols) ? cols : []) sel[c.key] = !!c.defaultOn;
  return sel;
}

function resolveExportColumnLabel(t, column) {
  if (column?.isDynamic) return String(column?.label || column?.key || '-');
  return t(column?.labelKey || column?.key || '-');
}

function formatDynamicFieldDisplay(value) {
  if (value == null) return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '-';
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((entry) => formatDynamicFieldDisplay(entry)).filter((entry) => entry && entry !== '-');
    return parts.length ? parts.join(', ') : '-';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '-';
    }
  }
  return String(value);
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      className={
        active
          ? 'rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.14)]'
          : 'rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-200 hover:bg-slate-50'
      }
      style={active ? { background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)' } : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

function SectionShell({ title, hint, action, children, ...props }) {
  return (
    <section
      className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]"
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
          {hint ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{hint}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ActionIconButton({ label, onClick, disabled = false, children, asLabel = false, className = '' }) {
  const sharedClassName = `inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 ${
    disabled ? 'cursor-not-allowed opacity-50' : ''
  } ${className}`.trim();

  if (asLabel) {
    return (
      <label className={sharedClassName} title={label} aria-label={label}>
        {children}
      </label>
    );
  }

  return (
    <button type="button" className={sharedClassName} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {children}
    </button>
  );
}

export default function AdminEpc() {
  const { t } = useT();
  const { user } = useAdminAuthStore((s) => ({ user: s.user }));
  const columnPrefsUserKey = useMemo(() => {
    const raw = String(user?.id || user?.email || 'guest').trim().toLowerCase();
    return raw.replace(/[^a-z0-9_-]+/g, '_') || 'guest';
  }, [user?.email, user?.id]);
  function scopedColumnKey(base) {
    return `${base}_${columnPrefsUserKey}`;
  }
  const role = user?.role || 'admin';
  const perms = useMemo(() => (Array.isArray(user?.permissions) ? user.permissions : []), [user?.permissions]);
  const allow = useCallback(
    (...keys) =>
      role === 'super_admin' || hasPermission(perms, '*') || keys.some((k) => (k ? hasPermission(perms, k) : false)),
    [perms, role]
  );
  const canBatchCreate = allow('epc.write', 'epc.batch.create');
  const canBatchView = allow('epc.read', 'epc.write', 'epc.batch.view', 'epc.production.access', 'epc.batch_import.access');
  const canExportXlsx = allow('epc.write', 'epc.export.xlsx', 'epc.production.access', 'epc.batch_import.access');
  const canEncoding = allow('epc.write', 'epc.encoding');
  const canDelete = useMemo(() => {
    if (role === 'super_admin' || hasPermission(perms, '*')) return true;
    return hasPermission(perms, 'epc.delete') && hasPermission(perms, 'epc.cleanup.delete');
  }, [perms, role]);
  const canClearGenerated = useMemo(() => {
    if (role === 'super_admin' || hasPermission(perms, '*')) return true;
    return hasPermission(perms, 'epc.delete') && hasPermission(perms, 'epc.cleanup.delete_all_generated');
  }, [perms, role]);
  const canProduction = allow('epc.production.access');
  const canBatchImport = allow('epc.batch_import.access');
  const canEditBatchDocs = allow('epc.write', 'epc.production.access', 'epc.batch_import.access');
  const canManageDynamicFields = canBatchImport;

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
    exportBatchImportTemplateXlsx,
    importProductionXlsx,
    previewBatchImportXlsx,
    previewBatchImportRange,
    submitBatchImport,
    submitBatchImportRange,
    fetchBatchImportHistory,
    getBatchImportHistory,
    markProductionDone,
    exportBatchXlsxCustom,
    exportItemsXlsx,
    deleteItems,
    deleteAllGeneratedBatches,
    fetchDynamicFields,
    createDynamicField,
    updateDynamicField,
    deleteDynamicField,
    updateBatchDocuments,
    updateBatch
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
    exportBatchImportTemplateXlsx: s.exportBatchImportTemplateXlsx,
    exportBatchXlsxCustom: s.exportBatchXlsxCustom,
    importProductionXlsx: s.importProductionXlsx,
    previewBatchImportXlsx: s.previewBatchImportXlsx,
    previewBatchImportRange: s.previewBatchImportRange,
    submitBatchImport: s.submitBatchImport,
    submitBatchImportRange: s.submitBatchImportRange,
    fetchBatchImportHistory: s.fetchBatchImportHistory,
    getBatchImportHistory: s.getBatchImportHistory,
    markProductionDone: s.markProductionDone,
    exportItemsXlsx: s.exportItemsXlsx,
    deleteItems: s.deleteItems,
    deleteAllGeneratedBatches: s.deleteAllGeneratedBatches,
    fetchDynamicFields: s.fetchDynamicFields,
    createDynamicField: s.createDynamicField,
    updateDynamicField: s.updateDynamicField,
    deleteDynamicField: s.deleteDynamicField,
    updateBatchDocuments: s.updateBatchDocuments,
    updateBatch: s.updateBatch
  }));

  const { products, fetchProducts } = useRecordsStore((s) => ({ products: s.products, fetchProducts: s.fetchProducts }));
  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({ templates: s.templates, fetchTemplates: s.fetchTemplates }));
  const { uploadMedia } = useUploadsStore((s) => ({ uploadMedia: s.uploadMedia }));
  const { updateCertificate, bulkAssignLandingDesign, assignIdentity } = useCertificatesStore((s) => ({
    updateCertificate: s.updateCertificate,
    bulkAssignLandingDesign: s.bulkAssignLandingDesign,
    assignIdentity: s.assignIdentity
  }));
  const { cmsDesigns, cmsDesignsLoading, cmsFetchDesigns } = useCmsStore((s) => ({
    cmsDesigns: s.designs,
    cmsDesignsLoading: s.loadingDesigns || s.loading,
    cmsFetchDesigns: s.fetchDesigns
  }));

  const [tab, setTab] = useState('batches');
  const [dynamicFields, setDynamicFields] = useState([]);

  const authTemplates = useMemo(() => (Array.isArray(templates) ? templates : []).filter((tpl) => String(tpl?.templateType || '').toLowerCase() === 'auth'), [templates]);

  const [batchQty, setBatchQty] = useState(1);
  const [remark, setRemark] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCorpPrefix, setGenerateCorpPrefix] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [listBatchId, setListBatchId] = useState('');
  const [listStatus, setListStatus] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [listOffset, setListOffset] = useState(0);
  const [listLimit, setListLimit] = useState(50);
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set());
  const [itemSort, setItemSort] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [exportItemColsOpen, setExportItemColsOpen] = useState(false);
  const [exportItemCols, setExportItemCols] = useState({});
  const [exportItemColsList, setExportItemColsList] = useState([]);

  const [exportColsOpen, setExportColsOpen] = useState(false);
  const [exportColsBatch, setExportColsBatch] = useState(null);
  const [exportCols, setExportCols] = useState({});
  const [exportColsList, setExportColsList] = useState([]);

  const DEFAULT_SUPPORTING_TYPES = useMemo(
    () => [
      { key: 'moh_health_certificate', label: 'mohHealthCertificate' },
      { key: 'export_permit', label: 'exportPermit' },
      { key: 'dvs_health_certificate', label: 'dvsHealthCertificate' },
      { key: 'dvs_coo_certificate', label: 'dvsCooCertificate' }
    ],
    []
  );

  const cleanFilenameToDocKey = useCallback((name, fallback = 'document') => {
    const base = String(name || '')
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || String(fallback || 'document');
  }, []);

  const isAutoPlaceholderDocKey = useCallback((k, idx) => {
    const v = String(k || '').trim();
    if (!v) return true;
    if (/^supporting_\d+$/.test(v)) return true;
    if (typeof idx === 'number' && v === `supporting_${idx + 1}`) return true;
    return false;
  }, []);

  const [importOpen, setImportOpen] = useState(false);
  const [importBatch, setImportBatch] = useState(null);
  const [importBase64, setImportBase64] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importProductId, setImportProductId] = useState('');
  const [importSku, setImportSku] = useState('');
  const [importAuthTemplateId, setImportAuthTemplateId] = useState('');
  const [importCmsDesignId, setImportCmsDesignId] = useState('');
  const [importDocRows, setImportDocRows] = useState(() => []);
  const [importDocUploading, setImportDocUploading] = useState(() => ({}));
  const [importLocalError, setImportLocalError] = useState('');
  const [importLastResult, setImportLastResult] = useState(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeCorpCode, setRangeCorpCode] = useState('');
  const [rangeDate, setRangeDate] = useState(() => toIsoDateInputValue());
  const [rangeStartRunningNo, setRangeStartRunningNo] = useState('');
  const [rangeEndRunningNo, setRangeEndRunningNo] = useState('');
  const [rangePreview, setRangePreview] = useState(null);
  const [rangeSelectedEpcs, setRangeSelectedEpcs] = useState(() => new Set());
  const [rangeProductId, setRangeProductId] = useState('');
  const [rangeAuthTemplateId, setRangeAuthTemplateId] = useState('');
  const [rangeCmsDesignId, setRangeCmsDesignId] = useState('');
  const [rangeDocRows, setRangeDocRows] = useState(() => []);
  const [rangeDocUploading, setRangeDocUploading] = useState(() => ({}));
  const [rangeLocalError, setRangeLocalError] = useState('');
  const [rangeRowValues, setRangeRowValues] = useState({});
  const [rangeBatchFillValues, setRangeBatchFillValues] = useState({});
  const [rangeEntryOpen, setRangeEntryOpen] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [importHistoryTotal, setImportHistoryTotal] = useState(0);
  const [importHistoryOffset, setImportHistoryOffset] = useState(0);
  const [importHistoryLimit, setImportHistoryLimit] = useState(20);
  const [selectedImportHistoryIds, setSelectedImportHistoryIds] = useState(() => new Set());
  const [importHistorySort, setImportHistorySort] = useState(null);
  const [importHistoryDetailSort, setImportHistoryDetailSort] = useState(null);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importHistoryDetail, setImportHistoryDetail] = useState(null);
  const [viewBatchOpen, setViewBatchOpen] = useState(false);
  const [viewBatch, setViewBatch] = useState(null);
  const [viewBatchLocalError, setViewBatchLocalError] = useState('');
  const [viewBatchDocUploading, setViewBatchDocUploading] = useState(() => ({
    moh_health_certificate: false,
    export_permit: false,
    dvs_health_certificate: false,
    dvs_coo_certificate: false
  }));
  const [viewBatchProductId, setViewBatchProductId] = useState('');
  const [viewBatchCmsDesignId, setViewBatchCmsDesignId] = useState('');
  const [viewBatchSaving, setViewBatchSaving] = useState(false);
  const [selectedProductionIds, setSelectedProductionIds] = useState(() => new Set());
  const [productionSort, setProductionSort] = useState(null);

  const [lpOpen, setLpOpen] = useState(false);
  const [lpEpcItemId, setLpEpcItemId] = useState(null);
  const [lpEpcCode, setLpEpcCode] = useState('');
  const [lpCertificateId, setLpCertificateId] = useState('');
  const [lpCertCmsDesignId, setLpCertCmsDesignId] = useState('');
  const [lpProductCmsDesignId, setLpProductCmsDesignId] = useState(null);
  const [lpProductCmsCertDesignId, setLpProductCmsCertDesignId] = useState(null);
  const [lpNoCertError, setLpNoCertError] = useState('');

  const [bulkLandingOpen, setBulkLandingOpen] = useState(false);
  const [bulkLandingDesignId, setBulkLandingDesignId] = useState('');
  const [bulkLandingSaving, setBulkLandingSaving] = useState(false);

  const [activateCertConfirmOpen, setActivateCertConfirmOpen] = useState(false);
  const [activateCertConfirmMeta, setActivateCertConfirmMeta] = useState(null);

  const getDocTypeLabel = useCallback(
    (docType) => {
      const found = DEFAULT_SUPPORTING_TYPES.find((d) => d.key === docType);
      if (found) return t(found.label);
      return String(docType || '-');
    },
    [DEFAULT_SUPPORTING_TYPES, t]
  );

  const buildDocumentsPayload = useCallback(
    (rows) => {
      const documents = {};
      const usedKeys = new Set();
      let autoIdx = 1;
      for (const row of Array.isArray(rows) ? rows : []) {
        const v = String(row?.url || '').trim();
        if (!v) continue;
        let k = String(row?.key || '').trim();
        if (!k || /^supporting_\d+$/.test(k) || usedKeys.has(k)) {
          const fromUrl = cleanFilenameToDocKey(v.split('/').pop() || v.split('\\').pop() || '', 'supporting');
          let candidate = fromUrl;
          let suffix = autoIdx;
          while (usedKeys.has(candidate)) {
            candidate = `${fromUrl}_${suffix}`;
            suffix += 1;
          }
          autoIdx = suffix + 1;
          k = candidate;
        }
        usedKeys.add(k);
        documents[k] = v;
      }
      return documents;
    },
    [cleanFilenameToDocKey]
  );

  const normalizeRangeRunningInput = useCallback((value) => String(value ?? '').replace(/\D/g, '').slice(0, 8), []);

  const paddedRangeStartRunningNo = useMemo(
    () => (rangeStartRunningNo ? String(rangeStartRunningNo).padStart(8, '0') : ''),
    [rangeStartRunningNo]
  );
  const paddedRangeEndRunningNo = useMemo(
    () => (rangeEndRunningNo ? String(rangeEndRunningNo).padStart(8, '0') : ''),
    [rangeEndRunningNo]
  );

  const rangePreviewLabel = useMemo(() => {
    const corp = String(rangeCorpCode || '').trim().toUpperCase();
    const ddmmyy = toDdMmYyFromIso(rangeDate);
    const startRun = String(paddedRangeStartRunningNo || '').trim();
    const endRun = String(paddedRangeEndRunningNo || '').trim();
    if (!corp || !ddmmyy || !startRun || !endRun) return '';
    return `${corp}${ddmmyy}${startRun} - ${corp}${ddmmyy}${endRun}`;
  }, [paddedRangeEndRunningNo, paddedRangeStartRunningNo, rangeCorpCode, rangeDate]);

  const rangePreviewItems = useMemo(() => (Array.isArray(rangePreview?.items) ? rangePreview.items : []), [rangePreview]);
  const rangeFieldSchema = useMemo(() => {
    const previewFields = Array.isArray(rangePreview?.fieldSchema) ? rangePreview.fieldSchema : [];
    if (previewFields.length > 0) return previewFields;
    return (Array.isArray(dynamicFields) ? dynamicFields : []).filter((field) => field?.isActive !== false);
  }, [dynamicFields, rangePreview]);
  const selectableRangeRows = useMemo(() => rangePreviewItems.filter((row) => row?.selectable), [rangePreviewItems]);
  const allSelectableRangeChecked = useMemo(() => {
    if (selectableRangeRows.length === 0) return false;
    return selectableRangeRows.every((row) => rangeSelectedEpcs.has(String(row.epcCode || '')));
  }, [rangeSelectedEpcs, selectableRangeRows]);
  const importPreviewFieldSchema = useMemo(() => (Array.isArray(importPreview?.fieldSchema) ? importPreview.fieldSchema : []), [importPreview]);
  const importPreviewFieldPresenceRows = useMemo(
    () =>
      importPreviewFieldSchema.map((field) => ({
        fieldKey: String(field?.fieldKey || '').trim(),
        label: String(field?.label || field?.fieldKey || '').trim(),
        value: Number(importPreview?.fieldPresence?.[field?.fieldKey] || 0)
      })),
    [importPreview?.fieldPresence, importPreviewFieldSchema]
  );

  const closeExportCols = useCallback(() => {
    setExportColsOpen(false);
    setExportColsBatch(null);
    setExportColsList([]);
    setExportCols({});
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailItem(null);
  }, []);

  const openExportCols = useCallback(
    (b) => {
      const batch = b || null;
      setExportColsBatch(batch);
      const tpl = resolveTemplateForBatch(batch, templates);
      const cols = deriveExportColumns(tpl, batch, dynamicFields, 'batch');
      setExportColsList(cols);
      setExportCols(buildDefaultSelection(cols));
      setExportColsOpen(true);
    },
    [dynamicFields, templates]
  );

  const closeExportItemCols = useCallback(() => {
    setExportItemColsOpen(false);
    setExportItemColsList([]);
    setExportItemCols({});
  }, []);

  const openExportItemCols = useCallback(
    (contextBatch) => {
      const batch = contextBatch || null;
      const tpl = resolveTemplateForBatch(batch, templates);
      const cols = deriveExportColumns(tpl, batch, dynamicFields, 'items');
      setExportItemColsList(cols);
      setExportItemCols(buildDefaultSelection(cols));
      setExportItemColsOpen(true);
    },
    [dynamicFields, templates]
  );

  const closeImport = useCallback(() => {
    setImportOpen(false);
    setImportBatch(null);
    setImportBase64('');
    setImportPreview(null);
    setImportProductId('');
    setImportSku('');
    setImportAuthTemplateId('');
    setImportCmsDesignId('');
    setImportDocRows([]);
    setImportDocUploading({});
    setImportLocalError('');
  }, []);

  const closeRange = useCallback(() => {
    setRangeOpen(false);
    setRangeCorpCode(Array.isArray(corpCodes) && corpCodes.length > 0 ? corpCodes[0] : '');
    setRangeDate(toIsoDateInputValue());
    setRangeStartRunningNo('');
    setRangeEndRunningNo('');
    setRangePreview(null);
    setRangeSelectedEpcs(new Set());
    setRangeProductId('');
    setRangeAuthTemplateId('');
    setRangeCmsDesignId('');
    setRangeDocRows([]);
    setRangeDocUploading({});
    setRangeLocalError('');
    setRangeRowValues({});
    setRangeBatchFillValues({});
    setRangeEntryOpen(false);
  }, [corpCodes]);

  const closeViewBatch = useCallback(() => {
    setViewBatchOpen(false);
    setViewBatch(null);
    setViewBatchLocalError('');
    setViewBatchProductId('');
    setViewBatchCmsDesignId('');
    setViewBatchSaving(false);
    setViewBatchDocUploading({
      moh_health_certificate: false,
      export_permit: false,
      dvs_health_certificate: false,
      dvs_coo_certificate: false
    });
  }, []);

  const openViewBatch = useCallback(async (b) => {
    if (!b) return;
    setViewBatch(b);
    setViewBatchOpen(true);
    setViewBatchLocalError('');
    setViewBatchSaving(false);
    setViewBatchProductId(b?.productId != null ? String(b.productId) : b?.product?.id != null ? String(b.product.id) : '');
    const linkedCertDesignId = b?.certificate?.cmsDesignId != null ? String(b.certificate.cmsDesignId) : '';
    setViewBatchCmsDesignId(linkedCertDesignId);
    try {
      if (!Array.isArray(products) || products.length === 0) await fetchProducts({ status: 'all' });
      if (!Array.isArray(cmsDesigns) || cmsDesigns.length === 0) await cmsFetchDesigns();
    } catch {
      /* ignore */
    }
  }, [cmsDesigns, cmsFetchDesigns, fetchProducts, products]);

  const openImport = useCallback(
    async (b) => {
      const batch = b || null;
      setImportBatch(batch);
      setImportOpen(true);
      setImportBase64('');
      setImportPreview(null);
      setImportLocalError('');
      setImportDocRows([]);
      setImportDocUploading({});
      setImportAuthTemplateId('');
      setImportCmsDesignId('');
      await fetchTemplates({ lang: 'en' });
      await fetchProducts({ status: 'all' });
      if (!Array.isArray(cmsDesigns) || cmsDesigns.length === 0) {
        try { await cmsFetchDesigns(); } catch (_) { /* ignore */ }
      }
    },
    [cmsDesigns, cmsFetchDesigns, fetchProducts, fetchTemplates]
  );

  const openRange = useCallback(async () => {
    setRangeOpen(true);
    setRangeLocalError('');
    setRangeCorpCode(Array.isArray(corpCodes) && corpCodes.length > 0 ? corpCodes[0] : String(rangeCorpCode || '').trim().toUpperCase());
    setRangeDate((prev) => prev || toIsoDateInputValue());
    setRangeStartRunningNo('');
    setRangeEndRunningNo('');
    setRangePreview(null);
    setRangeSelectedEpcs(new Set());
    setRangeDocRows([]);
    setRangeDocUploading({});
    setRangeAuthTemplateId('');
    setRangeCmsDesignId('');
    await fetchTemplates({ lang: 'en' });
    await fetchProducts({ status: 'all' });
    if (!Array.isArray(cmsDesigns) || cmsDesigns.length === 0) {
      try {
        await cmsFetchDesigns();
      } catch (_) {
        /* ignore */
      }
    }
  }, [cmsDesigns, cmsFetchDesigns, corpCodes, fetchProducts, fetchTemplates, rangeCorpCode]);

  const resolveBatchAuthCertificate = useCallback(
    (batch) => {
      if (!batch) return '-';
      const templatesList = Array.isArray(templates) ? templates : [];
      const explicitTemplateId = batch?.certificateTemplateId ?? batch?.certificateTemplate?.id ?? null;
      const batchCertificateId = String(batch?.certificateId ?? '').trim();
      let tpl = null;
      if (explicitTemplateId != null) {
        const idNum = Number(explicitTemplateId);
        if (Number.isFinite(idNum)) tpl = templatesList.find((t) => Number(t?.id) === idNum) || null;
      }
      if (!tpl && batchCertificateId) {
        tpl = templatesList.find((t) => String(t?.certificateId || '').trim() === batchCertificateId) || null;
      }
      const name = String(tpl?.name || batch?.certificateTemplate?.name || '').trim();
      const certId = String(tpl?.certificateId || '').trim();
      if (name) return certId ? `${certId} — ${name}` : name;
      if (explicitTemplateId != null) return String(explicitTemplateId);
      if (batchCertificateId) return batchCertificateId;
      return '-';
    },
    [templates]
  );

  useEffect(() => {
    if (!canBatchCreate && !canBatchView && !canBatchImport && !canProduction) return;
    void fetchCorpCodes();
  }, [canBatchCreate, canBatchImport, canBatchView, canProduction, fetchBatches, fetchCorpCodes]);

  useEffect(() => {
    if (Array.isArray(corpCodes) && corpCodes.length > 0 && !generateCorpPrefix) {
      setGenerateCorpPrefix(corpCodes[0]);
    }
  }, [corpCodes, generateCorpPrefix]);

  useEffect(() => {
    if (Array.isArray(corpCodes) && corpCodes.length > 0 && !rangeCorpCode) {
      setRangeCorpCode(corpCodes[0]);
    }
  }, [corpCodes, rangeCorpCode]);

  useEffect(() => {
    if (!(detailOpen || viewBatchOpen)) return;
    if (Array.isArray(templates) && templates.length) return;
    void fetchTemplates({ lang: 'en' });
  }, [detailOpen, fetchTemplates, templates, viewBatchOpen]);

  useEffect(() => {
    if (!canManageDynamicFields) return;
    void (async () => {
      const rows = await fetchDynamicFields({ activeOnly: true });
      setDynamicFields(Array.isArray(rows) ? rows : []);
    })();
  }, [canManageDynamicFields, fetchDynamicFields]);

  useEffect(() => {
    if (tab === 'import' && canBatchImport) {
      void fetchBatches({ origin: 'import', limit: 50, offset: 0 });
    } else if (tab === 'production' && canProduction) {
      void fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
    }
  }, [canBatchImport, canProduction, fetchBatches, tab]);

  useEffect(() => {
    if (tab !== 'import' || !canBatchImport) return;
    void (async () => {
      const data = await fetchBatchImportHistory({ limit: importHistoryLimit, offset: importHistoryOffset });
      setImportHistory(Array.isArray(data?.items) ? data.items : []);
      setImportHistoryTotal(Number(data?.total) || 0);
    })();
  }, [canBatchImport, fetchBatchImportHistory, importHistoryLimit, importHistoryOffset, tab]);

  useEffect(() => {
    if (tab === 'batches' && canBatchView) return;
    if (tab === 'import' && canBatchImport) return;
    if (tab === 'production' && canProduction) return;
    if (tab === 'fields' && canManageDynamicFields) return;
    if (canBatchView) setTab('batches');
    else if (canBatchImport) setTab('import');
    else if (canProduction) setTab('production');
    else if (canManageDynamicFields) setTab('fields');
  }, [canBatchImport, canBatchView, canManageDynamicFields, canProduction, tab]);

  useEffect(() => {
    if (tab !== 'batches' || !canBatchView) return;
    void fetchItems({
      q: listQuery,
      status: listStatus || undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      batchId: String(listBatchId || '').trim() || undefined,
      limit: listLimit,
      offset: listOffset
    });
  }, [canBatchView, createdFrom, createdTo, fetchItems, listBatchId, listLimit, listOffset, listQuery, listStatus, tab]);

  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [items, listOffset, listQuery, listBatchId, listStatus, createdFrom, createdTo]);

  useEffect(() => {
    void cmsFetchDesigns();
  }, [cmsFetchDesigns]);

  function resolveEpcCertificateId(it) {
    const idents = Array.isArray(it?.identities) ? it.identities : [];
    if (idents.length > 0 && idents[0].certificateId) return String(idents[0].certificateId);
    if (it?.batch?.certificateId) return String(it.batch.certificateId);
    return '';
  }

  const openLandingFromItem = useCallback((it) => {
    const item = it || null;
    if (!item) return;
    const certId = resolveEpcCertificateId(item);
    setLpEpcItemId(Number(item.id) || null);
    setLpEpcCode(String(item.epcCode || ''));
    setLpCertificateId(certId);
    setLpCertCmsDesignId('');
    setLpProductCmsDesignId(item?.batch?.product?.cmsDesignId ?? null);
    setLpProductCmsCertDesignId(item?.batch?.product?.cmsCertificateDesignId ?? null);
    if (!certId) {
      setLpNoCertError('This EPC is not linked to any Certificate Identity. Cannot edit landing page.');
    } else {
      setLpNoCertError('');
    }
    setLpOpen(true);
  }, []);

  const pageItemIds = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .map((it) => Number(it?.id))
        .filter((n) => Number.isFinite(n) && n > 0),
    [items]
  );
  const allPageSelected = useMemo(() => pageItemIds.length > 0 && pageItemIds.every((id) => selectedItemIds.has(id)), [pageItemIds, selectedItemIds]);
  const itemColumns = useMemo(
    () => [
      {
        id: 'select',
        label: t('selectAll'),
        lockedPosition: 'left',
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              checked={allPageSelected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => {
                setSelectedItemIds((prev) => {
                  const next = new Set(prev);
                  if (allPageSelected) pageItemIds.forEach((id) => next.delete(id));
                  else pageItemIds.forEach((id) => next.add(id));
                  return next;
                });
              }}
              aria-label={t('selectAll')}
            />
          </div>
        ),
        sortable: false,
        width: 52,
        minWidth: 52,
        maxWidth: 52,
        pinnable: false,
        hideable: false,
        resizable: false,
        cell: (it) => {
          const id = Number(it?.id);
          const checked = Number.isFinite(id) && selectedItemIds.has(id);
          return (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
                checked={checked}
                onClick={(e) => e.stopPropagation()}
                onChange={() => {
                  if (!Number.isFinite(id)) return;
                  setSelectedItemIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                aria-label={t('selectAll')}
              />
            </div>
          );
        },
        align: 'center',
        headerClassName: 'px-2',
        className: 'px-2'
      },
      {
        id: 'epcCode',
        header: t('epcCode'),
        width: 210,
        minWidth: 180,
        sortValue: (it) => String(it?.epcCode || ''),
        cell: (it) => (
          <button
            type="button"
            className="font-mono text-sm text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
            onClick={() => {
              setDetailItem(it || null);
              setDetailOpen(true);
            }}
          >
            {String(it?.epcCode || '')}
          </button>
        )
      },
      {
        id: 'batchId',
        header: t('batchId'),
        width: 110,
        minWidth: 96,
        sortValue: (it) => Number(it?.batchId || it?.batch?.id || 0),
        cell: (it) => <span className="font-mono text-sm text-slate-700">{String(it?.batchId || it?.batch?.id || '-')}</span>
      },
      {
        id: 'status',
        header: t('status'),
        width: 124,
        minWidth: 110,
        sortValue: (it) => String(it?.status || ''),
        cell: (it) => {
          const s = String(it?.status || '').toUpperCase();
          const active = s === 'ACTIVE';
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {active ? t('active') : t('inactive')}
            </span>
          );
        }
      },
      {
        id: 'createdAt',
        header: t('createdAt'),
        width: 172,
        minWidth: 156,
        sortValue: (it) => String(it?.createdAt || ''),
        cell: (it) => <span className="whitespace-nowrap text-sm text-slate-600">{formatDateTime(it?.createdAt)}</span>
      },
      {
        id: 'remark',
        header: t('remark'),
        minWidth: 180,
        sortValue: (it) => String(it?.batch?.remark || ''),
        cell: (it) => <span className="text-sm text-slate-700">{it?.batch?.remark ? String(it.batch.remark) : '-'}</span>
      },
      {
        id: 'actions',
        label: t('actions'),
        header: t('actions'),
        align: 'right',
        pinnable: false,
        hideable: false,
        sortable: false,
        resizable: false,
        width: 88,
        minWidth: 88,
        maxWidth: 88,
        cell: (it) => (
          <RowActionsMenu
            ariaLabel={t('actions')}
            items={[
              {
                key: 'view',
                label: t('view'),
                onSelect: () => {
                  setDetailItem(it || null);
                  setDetailOpen(true);
                }
              },
              {
                key: 'landing',
                label: 'Reassign Landing Page',
                onSelect: () => openLandingFromItem(it)
              }
            ]}
          />
        ),
        headerClassName: 'pr-3',
        className: 'pr-3'
      }
    ],
    [allPageSelected, openLandingFromItem, pageItemIds, selectedItemIds, t]
  );
  const sortedItems = useMemo(() => sortRows(Array.isArray(items) ? items : [], itemSort, itemColumns), [itemColumns, itemSort, items]);

  const importHistoryRowIds = useMemo(
    () =>
      (Array.isArray(importHistory) ? importHistory : [])
        .map((r) => Number(r?.id))
        .filter((n) => Number.isFinite(n) && n > 0),
    [importHistory]
  );
  const allImportHistorySelected = useMemo(
    () => importHistoryRowIds.length > 0 && importHistoryRowIds.every((id) => selectedImportHistoryIds.has(id)),
    [importHistoryRowIds, selectedImportHistoryIds]
  );

  const importHistoryColumns = useMemo(
    () => [
      {
        id: 'select',
        label: t('selectAll'),
        lockedPosition: 'left',
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              checked={allImportHistorySelected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => {
                setSelectedImportHistoryIds((prev) => {
                  const next = new Set(prev);
                  if (allImportHistorySelected) importHistoryRowIds.forEach((id) => next.delete(id));
                  else importHistoryRowIds.forEach((id) => next.add(id));
                  return next;
                });
              }}
              aria-label={t('selectAll')}
            />
          </div>
        ),
        sortable: false,
        width: 52,
        minWidth: 52,
        maxWidth: 52,
        pinnable: false,
        hideable: false,
        resizable: false,
        cell: (r) => {
          const id = Number(r?.id);
          const checked = Number.isFinite(id) && selectedImportHistoryIds.has(id);
          return (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
                checked={checked}
                onClick={(e) => e.stopPropagation()}
                onChange={() => {
                  if (!Number.isFinite(id)) return;
                  setSelectedImportHistoryIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                aria-label={t('selectAll')}
              />
            </div>
          );
        },
        align: 'center',
        headerClassName: 'px-2',
        className: 'px-2'
      },
      {
        id: 'time',
        header: t('time'),
        width: 176,
        minWidth: 160,
        sortValue: (r) => String(r?.createdAt || ''),
        cell: (r) => <span className="whitespace-nowrap text-sm text-slate-600">{formatDateTime(r?.createdAt)}</span>
      },
      {
        id: 'product',
        header: t('product'),
        minWidth: 180,
        sortValue: (r) => String(r?.summary?.productName || r?.summary?.productId || ''),
        cell: (r) => <span className="text-sm text-slate-700">{String(r?.summary?.productName || r?.summary?.productId || '-')}</span>
      },
      {
        id: 'certTemplate',
        header: t('certTemplate'),
        minWidth: 180,
        sortValue: (r) => String(r?.summary?.certificateTemplateName || r?.summary?.certificateTemplateId || ''),
        cell: (r) => <span className="text-sm text-slate-700">{String(r?.summary?.certificateTemplateName || r?.summary?.certificateTemplateId || '-')}</span>
      },
      {
        id: 'qtyEpc',
        header: t('qtyEpc'),
        width: 110,
        minWidth: 100,
        sortValue: (r) => Number(r?.summary?.uniqueEpcs ?? r?.summary?.rows ?? 0),
        cell: (r) => <span className="font-mono text-sm text-slate-700">{String(r?.summary?.uniqueEpcs ?? r?.summary?.rows ?? '-')}</span>
      },
      {
        id: 'action',
        label: t('actions'),
        header: '',
        align: 'right',
        pinnable: false,
        hideable: false,
        sortable: false,
        resizable: false,
        width: 92,
        minWidth: 92,
        maxWidth: 92,
        cell: (r) => (
          <button
            type="button"
            className="ac-btn ac-btn-soft px-3 py-2 text-xs"
            onClick={async () => {
              const detail = await getBatchImportHistory(r.id);
              setImportHistoryDetail(detail);
              setImportHistoryOpen(true);
            }}
          >
            {t('view')}
          </button>
        )
      }
    ],
    [allImportHistorySelected, getBatchImportHistory, importHistoryRowIds, selectedImportHistoryIds, t]
  );
  const sortedImportHistory = useMemo(
    () => sortRows(Array.isArray(importHistory) ? importHistory : [], importHistorySort, importHistoryColumns),
    [importHistory, importHistoryColumns, importHistorySort]
  );

  const importHistoryDetailRows = useMemo(
    () => (Array.isArray(importHistoryDetail?.metadata?.items) ? importHistoryDetail.metadata.items : []),
    [importHistoryDetail]
  );
  const importHistoryDetailFieldSchema = useMemo(() => {
    const metadataSchema = Array.isArray(importHistoryDetail?.metadata?.fieldSchema) ? importHistoryDetail.metadata.fieldSchema : [];
    if (metadataSchema.length > 0) return metadataSchema;

    const activeMap = new Map(
      (Array.isArray(dynamicFields) ? dynamicFields : [])
        .filter((field) => field?.fieldKey)
        .map((field) => [String(field.fieldKey).trim(), field])
    );

    const keys = new Set();
    for (const row of Array.isArray(importHistoryDetailRows) ? importHistoryDetailRows : []) {
      const values = row?.dynamicFields && typeof row.dynamicFields === 'object' && !Array.isArray(row.dynamicFields) ? row.dynamicFields : {};
      for (const key of Object.keys(values)) {
        const clean = String(key || '').trim();
        if (clean) keys.add(clean);
      }
    }

    return Array.from(keys).map((fieldKey, index) => {
      const active = activeMap.get(fieldKey);
      return {
        fieldKey,
        label: String(active?.label || active?.fieldKey || fieldKey),
        sortOrder: Number(active?.sortOrder ?? index),
        fieldType: String(active?.fieldType || 'text')
      };
    });
  }, [dynamicFields, importHistoryDetail, importHistoryDetailRows]);
  const importHistoryDetailColumns = useMemo(
    () => [
      {
        id: 'epc',
        header: t('epcCode'),
        width: 210,
        minWidth: 180,
        sortValue: (r) => String(r?.epcCode || ''),
        cell: (r) => <span className="font-mono text-sm text-slate-700">{String(r?.epcCode || '')}</span>
      },
      ...importHistoryDetailFieldSchema.map((field) => ({
        id: `dynamic_${String(field?.fieldKey || '')}`,
        header: String(field?.label || field?.fieldKey || '-'),
        minWidth: 180,
        sortValue: (r) => {
          const values = r?.dynamicFields && typeof r.dynamicFields === 'object' && !Array.isArray(r.dynamicFields) ? r.dynamicFields : {};
          return formatDynamicFieldDisplay(values?.[field.fieldKey]);
        },
        cell: (r) => {
          const values = r?.dynamicFields && typeof r.dynamicFields === 'object' && !Array.isArray(r.dynamicFields) ? r.dynamicFields : {};
          return <span className="text-sm text-slate-700">{formatDynamicFieldDisplay(values?.[field.fieldKey])}</span>;
        }
      }))
    ],
    [importHistoryDetailFieldSchema, t]
  );
  const sortedImportHistoryDetailRows = useMemo(
    () => sortRows(importHistoryDetailRows, importHistoryDetailSort, importHistoryDetailColumns),
    [importHistoryDetailColumns, importHistoryDetailRows, importHistoryDetailSort]
  );

  const productionRowIds = useMemo(
    () =>
      (Array.isArray(batches) ? batches : [])
        .map((b) => Number(b?.id))
        .filter((n) => Number.isFinite(n) && n > 0),
    [batches]
  );
  const allProductionSelected = useMemo(
    () => productionRowIds.length > 0 && productionRowIds.every((id) => selectedProductionIds.has(id)),
    [productionRowIds, selectedProductionIds]
  );

  const productionColumns = useMemo(
    () => [
      {
        id: 'select',
        label: t('selectAll'),
        lockedPosition: 'left',
        header: (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              checked={allProductionSelected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => {
                setSelectedProductionIds((prev) => {
                  const next = new Set(prev);
                  if (allProductionSelected) productionRowIds.forEach((id) => next.delete(id));
                  else productionRowIds.forEach((id) => next.add(id));
                  return next;
                });
              }}
              aria-label={t('selectAll')}
            />
          </div>
        ),
        sortable: false,
        width: 52,
        minWidth: 52,
        maxWidth: 52,
        pinnable: false,
        hideable: false,
        resizable: false,
        cell: (b) => {
          const id = Number(b?.id);
          const checked = Number.isFinite(id) && selectedProductionIds.has(id);
          return (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900"
                checked={checked}
                onClick={(e) => e.stopPropagation()}
                onChange={() => {
                  if (!Number.isFinite(id)) return;
                  setSelectedProductionIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                aria-label={t('selectAll')}
              />
            </div>
          );
        },
        align: 'center',
        headerClassName: 'px-2',
        className: 'px-2'
      },
      {
        id: 'batchName',
        header: t('batchName'),
        minWidth: 220,
        sortValue: (b) => String(b?.batchName || ''),
        cell: (b) => (
          <button type="button" className="truncate text-left text-sm font-semibold text-slate-900 hover:text-brand-700" onClick={() => openViewBatch(b)}>
            {String(b?.batchName || '-')}
          </button>
        )
      },
      {
        id: 'product',
        header: t('product'),
        minWidth: 180,
        sortValue: (b) => String(b?.product?.name || b?.sku || ''),
        cell: (b) => <span className="text-sm text-slate-700">{String(b?.product?.name || b?.sku || '-')}</span>
      },
      {
        id: 'uploadedAt',
        header: t('uploadedTime'),
        width: 170,
        minWidth: 152,
        sortValue: (b) => String(b?.productionUploadedAt || ''),
        cell: (b) => <span className="whitespace-nowrap text-sm text-slate-600">{b?.productionUploadedAt ? formatDateTime(b.productionUploadedAt) : t('notUploaded')}</span>
      },
      {
        id: 'uploadStatus',
        header: t('uploadStatus'),
        width: 136,
        minWidth: 124,
        sortValue: (b) => (b?.productionUploadedAt ? 1 : 0),
        cell: (b) => {
          const uploaded = Boolean(b?.productionUploadedAt);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                uploaded ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {uploaded ? 'Uploaded' : t('notUploaded')}
            </span>
          );
        }
      },
      {
        id: 'productionStatus',
        header: t('productionStatus'),
        width: 152,
        minWidth: 136,
        sortValue: (b) => (b?.productionDoneAt ? 1 : 0),
        cell: (b) => {
          const done = Boolean(b?.productionDoneAt);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {done ? t('markDone') : t('notDone')}
            </span>
          );
        }
      },
      {
        id: 'actions',
        label: t('actions'),
        header: t('actions'),
        align: 'right',
        pinnable: false,
        hideable: false,
        sortable: false,
        resizable: false,
        minWidth: 232,
        width: 248,
        maxWidth: 248,
        cell: (b) => {
          const done = Boolean(b?.productionDoneAt);
          return (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <ActionIconButton label={t('view')} onClick={() => openViewBatch(b)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </ActionIconButton>
              {canExportXlsx ? (
                <ActionIconButton label={t('exportXlsx')} onClick={() => openExportCols(b)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v11" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                </ActionIconButton>
              ) : null}
              {canEncoding ? (
                <ActionIconButton label={t('exportVerifyUrlXlsx')} onClick={() => exportBatchVerifyUrlXlsx(b.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L10 4" />
                    <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L14 20" />
                  </svg>
                </ActionIconButton>
              ) : null}
              <ActionIconButton label={t('importXlsx')} asLabel>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21V10" />
                  <path d="m17 14-5-5-5 5" />
                  <path d="M5 3h14" />
                </svg>
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const base64 = await toBase64(file);
                    const res = await importProductionXlsx({ batchId: b.id, base64 });
                    await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
                    const rows = Number(res?.rows || 0);
                    setActivateCertConfirmMeta({
                      source: 'productionImport',
                      batchId: Number(b?.id) > 0 ? Number(b.id) : null,
                      description: rows > 0 ? `Import completed - ${rows} EPC row(s) updated with the configured dynamic fields.` : 'Import completed.'
                    });
                    setActivateCertConfirmOpen(true);
                    e.target.value = '';
                  }}
                />
              </ActionIconButton>
              <ActionIconButton
                label={t('markDone')}
                disabled={loading || done}
                className="border-[rgba(var(--ac-brand-rgb),0.18)] bg-[var(--ac-brand)] text-white hover:border-[rgba(var(--ac-brand-rgb),0.3)] hover:bg-[var(--ac-brand-deep)] hover:text-white"
                onClick={async () => {
                  await markProductionDone({ batchId: b.id });
                  await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </ActionIconButton>
            </div>
          );
        }
      }
    ],
    [
      allProductionSelected,
      canEncoding,
      canExportXlsx,
      exportBatchVerifyUrlXlsx,
      fetchBatches,
      importProductionXlsx,
      loading,
      markProductionDone,
      openExportCols,
      openViewBatch,
      productionRowIds,
      selectedProductionIds,
      t
    ]
  );
  const sortedProductionRows = useMemo(
    () => sortRows(Array.isArray(batches) ? batches : [], productionSort, productionColumns),
    [batches, productionColumns, productionSort]
  );
  const handleRefreshActiveTab = useCallback(async () => {
    if (tab === 'fields' && canManageDynamicFields) {
      const rows = await fetchDynamicFields({ activeOnly: true });
      setDynamicFields(Array.isArray(rows) ? rows : []);
      return;
    }

    if (tab === 'import' && canBatchImport) {
      const data = await fetchBatchImportHistory({ limit: importHistoryLimit, offset: importHistoryOffset });
      setImportHistory(Array.isArray(data?.items) ? data.items : []);
      setImportHistoryTotal(Number(data?.total) || 0);
      return;
    }

    if (tab === 'production' && canProduction) {
      await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
      return;
    }

    if (canBatchView) {
      await fetchItems({
        q: listQuery,
        status: listStatus || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        batchId: String(listBatchId || '').trim() || undefined,
        limit: listLimit,
        offset: listOffset
      });
      await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
    }
  }, [
    canBatchImport,
    canBatchView,
    canManageDynamicFields,
    canProduction,
    createdFrom,
    createdTo,
    fetchDynamicFields,
    fetchBatchImportHistory,
    fetchBatches,
    fetchItems,
    importHistoryLimit,
    importHistoryOffset,
    listBatchId,
    listLimit,
    listOffset,
    listQuery,
    listStatus,
    tab
  ]);

  const handleRefreshDynamicFields = useCallback(async () => {
    const rows = await fetchDynamicFields({ activeOnly: true });
    setDynamicFields(Array.isArray(rows) ? rows : []);
    return rows;
  }, [fetchDynamicFields]);

  const handleRangeToggleAll = useCallback(() => {
    setRangeSelectedEpcs(() => {
      if (allSelectableRangeChecked) return new Set();
      return new Set(selectableRangeRows.map((row) => String(row.epcCode || '')));
    });
  }, [allSelectableRangeChecked, selectableRangeRows]);

  const handleRangeToggleRow = useCallback((epcCode, checked) => {
    const code = String(epcCode || '').trim();
    if (!code) return;
    setRangeSelectedEpcs((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }, []);

  const handleRangeRowValueChange = useCallback((epcCode, fieldKey, value) => {
    const code = String(epcCode || '').trim();
    const key = String(fieldKey || '').trim();
    if (!code || !key) return;
    setRangeRowValues((prev) => ({
      ...prev,
      [code]: {
        ...(prev?.[code] || {}),
        [key]: value
      }
    }));
  }, []);

  const handleRangeBatchFillChange = useCallback((fieldKey, value) => {
    const key = String(fieldKey || '').trim();
    if (!key) return;
    setRangeBatchFillValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleApplyRangeBatchFill = useCallback(
    (fieldKey) => {
      const key = String(fieldKey || '').trim();
      if (!key || rangeSelectedEpcs.size === 0) return;
      const fillValue = rangeBatchFillValues?.[key] ?? '';
      setRangeRowValues((prev) => {
        const next = { ...(prev || {}) };
        for (const epcCode of rangeSelectedEpcs) {
          next[epcCode] = {
            ...(next?.[epcCode] || {}),
            [key]: fillValue
          };
        }
        return next;
      });
    },
    [rangeBatchFillValues, rangeSelectedEpcs]
  );

  return (
    <div className="space-y-4 p-4 sm:p-5 lg:p-6" data-tour="epc-page">
      <div
        className="flex items-start justify-between gap-4 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,var(--ac-bg-soft)_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]"
        data-tour="epc-header"
      >
        <div className="min-w-0">
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-slate-950">{t('epcManagement')}</h2>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          onClick={() => void handleRefreshActiveTab()}
          aria-label={t('refresh')}
          title={t('refresh')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      <div className="inline-flex w-fit rounded-[20px] border border-slate-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]" data-tour="epc-tabs">
        {canBatchView ? (
          <TabButton active={tab === 'batches'} onClick={() => setTab('batches')}>
            {t('epcBatches')}
          </TabButton>
        ) : null}
        {canBatchImport ? (
          <TabButton active={tab === 'import'} onClick={() => setTab('import')}>
            {t('epcAssignment')}
          </TabButton>
        ) : null}
        {canProduction ? (
          <TabButton active={tab === 'production'} onClick={() => setTab('production')}>
            {t('labelProductionRecord')}
          </TabButton>
        ) : null}
        {canManageDynamicFields ? (
          <TabButton active={tab === 'fields'} onClick={() => setTab('fields')}>
            {t('batchFields')}
          </TabButton>
        ) : null}
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {!canBatchCreate && !canBatchView && !canBatchImport && !canProduction ? (
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 text-sm text-slate-700">Insufficient permissions</div>
      ) : null}

      {tab === 'batches' && canBatchView ? (
        <SectionShell
          badge={t('epcManagement')}
          title={t('epcItems')}
          hint={t('guideStepBatchesBody')}
          data-tour="epc-items-card"
          action={
            <>
              {canExportXlsx ? (
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={loading || (Number(itemTotal) || 0) === 0}
                  onClick={() => openExportItemCols(null)}
                >
                  {t('exportXlsx')}
                </button>
              ) : null}
              {canEditBatchDocs ? (
                <button
                  type="button"
                  className="ac-btn ac-btn-soft ac-btn-soft-brand px-3 py-2 text-xs"
                  disabled={loading || selectedItemIds.size === 0 || cmsDesignsLoading}
                  onClick={async () => {
                    if (!Array.isArray(cmsDesigns) || cmsDesigns.length === 0) {
                      try {
                        await cmsFetchDesigns();
                      } catch {
                        /* ignore */
                      }
                    }
                    setBulkLandingDesignId('');
                    setBulkLandingOpen(true);
                  }}
                >
                  Assign Landing Page
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
                      status: listStatus || undefined,
                      createdFrom: createdFrom || undefined,
                      createdTo: createdTo || undefined,
                      batchId: String(listBatchId || '').trim() || undefined,
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
                  className="ac-btn ac-btn-soft ac-btn-soft-danger px-3 py-2 text-xs"
                  disabled={loading}
                  onClick={async () => {
                    if (!window.confirm(t('confirmClearAllGeneratedEpc'))) return;
                    const res = await deleteAllGeneratedBatches({});
                    if (!res) return;
                    setSelectedItemIds(new Set());
                    setListOffset(0);
                    await fetchItems({
                      q: listQuery,
                      status: listStatus || undefined,
                      createdFrom: createdFrom || undefined,
                      createdTo: createdTo || undefined,
                      batchId: String(listBatchId || '').trim() || undefined,
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
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
                <div className="flex flex-col gap-1 xl:col-span-7">
                  <label htmlFor="searchEpcCode" className="text-[11px] font-medium text-slate-500">
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
                <div className="flex flex-col gap-1 xl:col-span-3">
                  <label htmlFor="batchId" className="text-[11px] font-medium text-slate-500">
                    {t('batchId')}
                  </label>
                  <input
                    id="batchId"
                    value={listBatchId}
                    onChange={(e) => {
                      setListBatchId(e.target.value);
                      setListOffset(0);
                    }}
                    placeholder={t('batchId')}
                    className="ac-input"
                  />
                </div>
                <div className="flex flex-col gap-1 xl:col-span-2">
                  <label htmlFor="epcStatus" className="text-[11px] font-medium text-slate-500">
                    {t('status')}
                  </label>
                  <select
                    id="epcStatus"
                    value={listStatus}
                    onChange={(e) => {
                      setListStatus(e.target.value);
                      setListOffset(0);
                    }}
                    className="ac-input bg-white"
                  >
                    <option value="">{t('allStatuses')}</option>
                    <option value="ACTIVE">{t('active')}</option>
                    <option value="INACTIVE">{t('inactive')}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 xl:col-span-4">
                  <label htmlFor="createdFrom" className="text-[11px] font-medium text-slate-500">
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
                <div className="flex flex-col gap-1 xl:col-span-4">
                  <label htmlFor="createdTo" className="text-[11px] font-medium text-slate-500">
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
                <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-4">
                  <div aria-hidden className="select-none text-[11px] text-transparent">
                    .
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-4 py-3 text-sm"
                      onClick={() =>
                        fetchItems({
                          q: listQuery,
                          status: listStatus || undefined,
                          createdFrom: createdFrom || undefined,
                          createdTo: createdTo || undefined,
                          batchId: String(listBatchId || '').trim() || undefined,
                          limit: listLimit,
                          offset: 0
                        })
                      }
                    >
                      {t('inquire')}
                    </button>
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-4 py-3 text-sm"
                      onClick={() => {
                        setListQuery('');
                        setListBatchId('');
                        setListStatus('');
                        setCreatedFrom('');
                        setCreatedTo('');
                        setListOffset(0);
                      }}
                    >
                      {t('clearFilters')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <DataTable
              sortState={itemSort}
              onSortChange={setItemSort}
              density="compact"
              minWidth={980}
              rows={sortedItems}
              rowKey={(it) => it.id}
              loading={loading}
              loadingContent={t('loading')}
              emptyContent={
                <div>
                  <div className="text-sm font-semibold text-slate-900">{t('noEpc')}</div>
                  <div className="mt-1 text-sm text-slate-600">{t('guideStepBatchesBody')}</div>
                </div>
              }
              top={
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t('epcItems')}</div>
                  </div>
                  {selectedItemIds.size > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">{t('selectedProducts', { value: selectedItemIds.size })}</div>
                      <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-sm" onClick={() => setSelectedItemIds(new Set())}>
                        {t('clearSelection')}
                      </button>
                    </div>
                  ) : null}
                </div>
              }
              bottom={
                <TablePager
                  offset={listOffset}
                  limit={listLimit}
                  total={Number(itemTotal) || 0}
                  loading={loading}
                  onOffsetChange={(next) => setListOffset(next)}
                  onLimitChange={(next) => {
                    setListLimit(next);
                    setListOffset(0);
                  }}
                />
              }
              columns={itemColumns}
              columnTools={{
                enabled: true,
                storageKey: scopedColumnKey('ac_epc_items_v3'),
                initialPinnedIds: ['select', 'epcCode'],
                defaultColumnWidth: 110
              }}
            />
          </div>
        </SectionShell>
      ) : null}

      {detailOpen && detailItem ? (
        <div
          className="ac-overlay-center"
          role="dialog"
          aria-modal="true"
          onClick={closeDetail}
        >
          <div
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-tight text-slate-950">{t('epcDetails')}</div>
                <div className="mt-1 truncate font-mono text-sm text-slate-600">{String(detailItem.epcCode || '')}</div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-sm" onClick={closeDetail}>
                {t('close')}
              </button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('epcCode')}</div>
                    <div className="mt-2 break-all font-mono text-sm text-slate-900">{String(detailItem.epcCode || '-')}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('status')}</div>
                    <div className="mt-2">
                      {(() => {
                        const isActive = String(detailItem?.status || '').toUpperCase() === 'ACTIVE';
                        return (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isActive ? t('active') : t('inactive')}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('product')}</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {detailItem?.batch?.product?.name ? String(detailItem.batch.product.name) : '-'}
                  </div>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('certTemplate')}</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{resolveBatchAuthCertificate(detailItem?.batch)}</div>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Linked Certificate</div>
                  <div className="mt-2 break-all font-mono text-sm text-slate-900">{resolveEpcCertificateId(detailItem) || '(not linked yet)'}</div>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('createdAt')}</div>
                  <div className="mt-2 text-sm text-slate-900">{formatDateTime(detailItem.createdAt) || '-'}</div>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white p-4 sm:col-span-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('remark')}</div>
                  <div className="mt-2 text-sm text-slate-900">{detailItem?.batch?.remark ? String(detailItem.batch.remark) : '-'}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                className="ac-btn px-4 py-2 text-sm"
                onClick={() => openLandingFromItem(detailItem)}
                disabled={!resolveEpcCertificateId(detailItem)}
                title={!resolveEpcCertificateId(detailItem) ? 'EPC belum dikaitkan dengan Certificate Identity' : ''}
              >
                Reassign Landing Page
              </button>
              <button type="button" className="ac-btn ac-btn-soft px-4 py-2 text-sm" onClick={closeDetail}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {lpOpen ? (
        <div
          className="ac-overlay-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setLpOpen(false)}
        >
          <div
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">Reassign Landing Page</div>
                <div className="mt-1 truncate font-mono text-[11px] text-zinc-600">EPC: {lpEpcCode || '-'}</div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setLpOpen(false)}>
                {t('close')}
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">Linked Certificate ID</div>
                <input
                  value={lpCertificateId}
                  readOnly
                  className="ac-input bg-zinc-50 px-3 py-2 text-xs w-full font-mono"
                />
              </div>

              {lpNoCertError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                  {lpNoCertError}
                </div>
              ) : null}

              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">
                  EPC Landing Page Override (Tier 1 — Highest)
                </div>
                <select
                  value={lpCertCmsDesignId}
                  onChange={(e) => setLpCertCmsDesignId(e.target.value)}
                  disabled={cmsDesignsLoading || !!lpNoCertError}
                  className="ac-input px-3 py-2 text-xs w-full"
                >
                  <option value="">— Fallback to Product (no per-EPC override) —</option>
                  {Array.isArray(cmsDesigns)
                    ? cmsDesigns.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          [{d.id}] {d.name || '(unnamed)'}
                        </option>
                      ))
                    : null}
                </select>
                <div className="mt-1 text-[10px] text-zinc-500">
                  * Pilih design bundle untuk EPC ini sahaja. Akan override setting Product.
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] space-y-1.5">
                <div className="font-semibold text-zinc-700">Current fallback chain (if above empty):</div>
                <div>
                  <span className="text-zinc-500">Tier 2 — Product.cmsCertificateDesignId:</span>{' '}
                  <span className="font-mono text-zinc-800">
                    {lpProductCmsCertDesignId != null ? `#${lpProductCmsCertDesignId}` : '(empty)'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Tier 3 — Product.cmsDesignId:</span>{' '}
                  <span className="font-mono text-zinc-800">
                    {lpProductCmsDesignId != null ? `#${lpProductCmsDesignId}` : '(empty)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setLpOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!!lpNoCertError || !lpCertificateId || cmsDesignsLoading}
                onClick={async () => {
                  if (!lpCertificateId) return;
                  const cmsDesignId = lpCertCmsDesignId.trim() === '' ? null : Number(lpCertCmsDesignId);
                  await updateCertificate({
                    certificateId: lpCertificateId,
                    patch: { cmsDesignId }
                  });
                  setLpOpen(false);
                  void fetchItems({
                    q: listQuery,
                    batchId: listBatchId,
                    status: listStatus,
                    createdFrom,
                    createdTo,
                    limit: listLimit,
                    offset: listOffset
                  });
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportItemColsOpen ? (
        <div
          className="ac-overlay-center"
          role="dialog"
          aria-modal="true"
          onClick={closeExportItemCols}
        >
          <div
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{t('exportColumnsTitleEpcList')}</div>
                <div className="mt-1 text-[11px] text-zinc-500">{t('total', { value: Number(itemTotal) || 0 })}</div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeExportItemCols}>
                {t('close')}
              </button>
            </div>

            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() => {
                    const next = {};
                    for (const c of exportItemColsList) next[c.key] = true;
                    setExportItemCols(next);
                  }}
                >
                  {t('select')}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() => {
                    const next = {};
                    for (const c of exportItemColsList) next[c.key] = false;
                    setExportItemCols(next);
                  }}
                >
                  {t('clear')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {exportItemColsList.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-xs text-zinc-800">
                    <input
                      type="checkbox"
                      checked={Boolean(exportItemCols[c.key])}
                      onChange={(e) => setExportItemCols((p) => ({ ...p, [c.key]: e.target.checked }))}
                    />
                    {resolveExportColumnLabel(t, c)}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeExportItemCols}>
                {t('close')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={loading || (Number(itemTotal) || 0) === 0 || Object.values(exportItemCols || {}).filter(Boolean).length === 0}
                onClick={async () => {
                  const cols = exportItemColsList.map((c) => c.key).filter((k) => Boolean(exportItemCols?.[k]));
                  await exportItemsXlsx({
                    q: listQuery,
                    createdFrom: createdFrom || undefined,
                    createdTo: createdTo || undefined,
                    columns: cols
                  });
                  closeExportItemCols();
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
          className="ac-overlay-center"
          role="dialog"
          aria-modal="true"
          onClick={closeExportCols}
        >
          <div
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
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
                  onClick={() => {
                    const next = {};
                    for (const c of exportColsList) next[c.key] = true;
                    setExportCols(next);
                  }}
                >
                  {t('select')}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  onClick={() => {
                    const next = {};
                    for (const c of exportColsList) next[c.key] = false;
                    setExportCols(next);
                  }}
                >
                  {t('clear')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {exportColsList.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-xs text-zinc-800">
                    <input
                      type="checkbox"
                      checked={Boolean(exportCols[c.key])}
                      onChange={(e) => setExportCols((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                    />
                    {resolveExportColumnLabel(t, c)}
                  </label>
                ))}
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
                  const cols = exportColsList.map((c) => c.key).filter((k) => Boolean(exportCols?.[k]));
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
        <SectionShell
          badge={t('epcAssignment')}
          title={t('epcAssignment')}
          hint={t('batchImportExistingEpcHint')}
          action={
            <>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                disabled={loading}
                onClick={async () => {
                  const data = await fetchBatchImportHistory({ limit: importHistoryLimit, offset: importHistoryOffset });
                  setImportHistory(Array.isArray(data?.items) ? data.items : []);
                  setImportHistoryTotal(Number(data?.total) || 0);
                }}
              >
                {t('refresh')}
              </button>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" disabled={loading} onClick={openRange}>
                {t('activateEpcRange')}
              </button>
              <button type="button" className="ac-btn ac-btn-primary px-3 py-2 text-xs" disabled={loading} onClick={() => openImport(null)}>
                {t('importBatchFile')}
              </button>
            </>
          }
        >
          <div className="text-sm text-zinc-700">
            {importLastResult ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <div className="font-semibold">{t('save')} OK</div>
                <div className="mt-1">
                  {t('rowsLabel')}: {String(importLastResult?.rows ?? 0)} • {t('uniqueEpcLabel')}: {String(importLastResult?.uniqueEpcs ?? 0)} • Updated:{' '}
                  {String(importLastResult?.updated ?? 0)}
                </div>
                {Number(importLastResult?.activated) > 0 || Number(importLastResult?.created) > 0 ? (
                  <div className="mt-1">
                    Activated: {String(importLastResult?.activated ?? 0)} • Created identities: {String(importLastResult?.created ?? 0)}
                  </div>
                ) : null}
                {Array.isArray(importLastResult?.batchIds) && importLastResult.batchIds.length > 0 ? (
                  <div className="mt-1">
                    {t('batchId')}: {importLastResult.batchIds.map((id) => String(id)).join(', ')}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              <DataTable
                sortState={importHistorySort}
                onSortChange={setImportHistorySort}
                density="compact"
                minWidth={760}
                rows={sortedImportHistory}
                rowKey={(r) => r.id}
                loading={loading}
                loadingContent={t('loading')}
                emptyContent={
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t('noImportHistory')}</div>
                    <div className="mt-1 text-sm text-slate-600">{t('batchImportExistingEpcHint')}</div>
                  </div>
                }
                top={
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t('importHistory')}</div>
                  </div>
                }
                bottom={
                  <TablePager
                    offset={importHistoryOffset}
                    limit={importHistoryLimit}
                    total={Number(importHistoryTotal) || 0}
                    loading={loading}
                    onOffsetChange={(next) => setImportHistoryOffset(next)}
                    onLimitChange={(next) => {
                      setImportHistoryLimit(next);
                      setImportHistoryOffset(0);
                    }}
                  />
                }
                columns={importHistoryColumns}
                columnTools={{
                  enabled: true,
                  storageKey: scopedColumnKey('ac_epc_import_history_v3'),
                  initialPinnedIds: ['time'],
                  defaultColumnWidth: 112
                }}
              />
            </div>
          </div>
        </SectionShell>
      ) : null}

      {tab === 'fields' && canManageDynamicFields ? (
        <SectionShell title={t('batchFields')} hint={t('batchFieldsHint')}>
          <EpcDynamicFieldsPanel
            t={t}
            fields={dynamicFields}
            loading={loading}
            error={error}
            onRefresh={handleRefreshDynamicFields}
            onCreate={createDynamicField}
            onUpdate={updateDynamicField}
            onDelete={deleteDynamicField}
          />
        </SectionShell>
      ) : null}

      {importHistoryOpen && importHistoryDetail ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[84rem] flex-col overflow-hidden">
            <div className="mb-3 text-sm font-semibold text-zinc-900">{t('importDetails')}</div>
            <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-zinc-700 sm:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold text-zinc-600">{t('time')}</div>
                <div className="mt-0.5">{formatDateTime(importHistoryDetail?.createdAt) || '-'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-600">{t('importedBy')}</div>
                <div className="mt-0.5">{String(importHistoryDetail?.actorEmail || '-')}</div>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 sm:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold text-zinc-600">{t('qtyEpc')}</div>
                <div className="mt-0.5 font-mono">{String(importHistoryDetailRows.length || importHistoryDetail?.summary?.uniqueEpcs || 0)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-600">{t('fieldsConfigured')}</div>
                <div className="mt-0.5 font-mono">{String(importHistoryDetailFieldSchema.length)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-600">{t('source')}</div>
                <div className="mt-0.5">{String(importHistoryDetail?.summary?.source || importHistoryDetail?.metadata?.source || '-')}</div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <DataTable
                sortState={importHistoryDetailSort}
                onSortChange={setImportHistoryDetailSort}
                density="compact"
                minWidth={Math.max(640, 220 + importHistoryDetailFieldSchema.length * 180)}
                rows={sortedImportHistoryDetailRows}
                rowKey={(r) => String(r?.epcCode || '')}
                loading={loading}
                loadingContent={t('loading')}
                emptyContent={t('noEpc')}
                columns={importHistoryDetailColumns}
                columnTools={{
                  enabled: true,
                  storageKey: scopedColumnKey('ac_epc_import_history_detail_v5'),
                  initialPinnedIds: ['epc'],
                  defaultColumnWidth: 112
                }}
              />
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setImportHistoryOpen(false);
                  setImportHistoryDetail(null);
                }}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkLandingOpen ? (
        <div
          className="ac-overlay-center"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!bulkLandingSaving) setBulkLandingOpen(false);
          }}
        >
          <div
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{t('bulkAssignLandingDesign') || 'Bulk Assign Landing Page Design'}</div>
                <div className="mt-1 truncate text-xs text-zinc-500">
                  {`${selectedItemIds.size} EPC item(s) dipilih`}
                </div>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                disabled={bulkLandingSaving}
                onClick={() => setBulkLandingOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="text-[11px] font-semibold text-zinc-600">
                  {t('landingPageDesign')}
                </label>
                <select
                  className="ac-input mt-1 w-full text-xs"
                  value={bulkLandingDesignId}
                  onChange={(e) => setBulkLandingDesignId(e.target.value)}
                  disabled={bulkLandingSaving || cmsDesignsLoading}
                >
                  <option value="">— {t('followProduct')} (clear Tier 1 override) —</option>
                  {(Array.isArray(cmsDesigns) ? cmsDesigns : []).map((d) => (
                    <option key={String(d.id)} value={String(d.id)}>
                      {String(d.name || `Design ${d.id}`)}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-[10px] text-zinc-500">
                  Sila pilih design Landing Page yang hendak di-apply ke semua Certificate bagi EPC items yang dipilih.
                  Jika pilih "Follow Product", Tier 1 override akan dikeluarkan dan akan guna Tier 2/Tier 3 fallback.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-primary px-4 py-2 text-xs"
                  disabled={bulkLandingSaving || cmsDesignsLoading}
                  onClick={async () => {
                    try {
                      setBulkLandingSaving(true);
                      const epcItemIds = Array.from(selectedItemIds).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
                      const selectedItems = (Array.isArray(items) ? items : []).filter((i) => epcItemIds.includes(Number(i?.id)));
                      const certIdsSet = new Set();
                      let noCertCount = 0;
                      for (const it of selectedItems) {
                        const idCert = it?.identities && it.identities[0]?.certificateId;
                        const batchCert = it?.batch?.certificateId;
                        const cid = idCert || batchCert;
                        if (cid) certIdsSet.add(String(cid));
                        else noCertCount += 1;
                      }
                      const certificateIds = Array.from(certIdsSet);
                      if (certificateIds.length === 0) {
                        throw new Error('No certificate can be unlinked from the selected EPC items.');
                      }
                      const designRaw = String(bulkLandingDesignId || '').trim();
                      const cmsDesignId = designRaw ? Number(designRaw) : null;
                      const res = await bulkAssignLandingDesign({ certificateIds, cmsDesignId });
                      const count = Number(res?.updatedCount) || 0;
                      window.alert(
                        `Berjaya update ${count} certificate${noCertCount ? ` (${noCertCount} EPC items tiada certificate linked, dilepaskan)` : ''}.`
                      );
                      setBulkLandingOpen(false);
                      setSelectedItemIds(new Set());
                      setListOffset(0);
                      await fetchItems({
                        q: listQuery,
                        status: listStatus || undefined,
                        createdFrom: createdFrom || undefined,
                        createdTo: createdTo || undefined,
                        batchId: String(listBatchId || '').trim() || undefined,
                        limit: listLimit,
                        offset: 0
                      });
                    } catch (err) {
                      const msg = err?.message || tRaw('operationFailed');
                      window.alert(msg);
                    } finally {
                      setBulkLandingSaving(false);
                    }
                  }}
                >
                  {bulkLandingSaving ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activateCertConfirmOpen && activateCertConfirmMeta ? (
        <div
          className="ac-overlay-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setActivateCertConfirmOpen(false)}
        >
          <div
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">Activate Certificate Confirmation</div>
                <div className="mt-1 truncate text-xs text-zinc-500">Please confirm that you want to activate the certificate under this NFC</div>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => setActivateCertConfirmOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="space-y-3 p-4 text-xs text-zinc-700">
              <p className="text-xs">
                {activateCertConfirmMeta.description || 'Import completed successfully.'}
              </p>
              {typeof activateCertConfirmMeta.batchId === 'number' && activateCertConfirmMeta.batchId > 0 ? (
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
                  <div className="text-[11px] font-semibold text-zinc-600">Batch ID</div>
                  <div className="mt-0.5 font-mono text-xs">#{String(activateCertConfirmMeta.batchId)}</div>
                </div>
              ) : null}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800">
                Please confirm to proceed with certificate activation for these NFC tags. The system will:
                <ul className="mt-1.5 space-y-1 list-disc pl-5">
                  <li>Link certificate ID to all newly imported EPC items</li>
                  <li>Enable /verify flow (resolve endpoint) for all these NFC tags</li>
                  <li>Apply 3-tier Landing Page Design (Tier 1 Certificate override → Tier 2 Product cert → Tier 3 Product main)</li>
                </ul>
              </div>
              <p className="text-[11px] text-zinc-600">
                <strong>Note</strong>: Activation now follows the configured EPC dynamic field schema. Only EPC is always mandatory unless a field is marked required in Batch Fields.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                className="ac-btn ac-btn-soft px-4 py-2 text-xs"
                onClick={() => {
                  setActivateCertConfirmOpen(false);
                  setActivateCertConfirmMeta(null);
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-4 py-2 text-xs"
                onClick={async () => {
                  try {
                    window.alert('Certificate activation confirmed. Imported EPC items are now available in the verification flow.');
                    setActivateCertConfirmOpen(false);
                    setActivateCertConfirmMeta(null);
                    await fetchItems({
                      q: listQuery,
                      status: listStatus || undefined,
                      createdFrom: createdFrom || undefined,
                      createdTo: createdTo || undefined,
                      batchId: String(listBatchId || '').trim() || undefined,
                      limit: listLimit,
                      offset: 0
                    });
                    await fetchBatches({ origin: 'generated', limit: 50, offset: 0 });
                  } catch (err) {
                    window.alert(err?.message || 'Confirmation failed.');
                  }
                }}
              >
                Confirm & Activate Certificate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewBatchOpen && viewBatch ? (
        <div
          className="ac-overlay-center"
          role="dialog"
          aria-modal="true"
          onClick={closeViewBatch}
        >
          <div
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
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
              {viewBatchLocalError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{viewBatchLocalError}</div>
              ) : null}
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
                  <label className="text-[11px] font-semibold text-zinc-600">{t('product')}</label>
                  {canEditBatchDocs ? (
                    <select
                      className="ac-input mt-1 text-xs"
                      value={viewBatchProductId}
                      onChange={(e) => {
                        setViewBatchLocalError('');
                        setViewBatchProductId(e.target.value);
                      }}
                    >
                      <option value="">— {t('notSet')} —</option>
                      {(Array.isArray(products) ? products : []).map((p) => (
                        <option key={String(p.id)} value={String(p.id)}>
                          {String(p.sku || p.code || '')} — {String(p.name || '')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 text-xs text-zinc-900">{String(viewBatch?.product?.name || '-')}</div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-600">{t('sku')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{String(viewBatch?.sku || viewBatch?.product?.sku || '-')}</div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-zinc-600">
                    {t('landingPageDesign')}
                    {' '}
                    {canEditBatchDocs ? null : (
                      <span className="ml-1 text-[10px] font-normal text-zinc-500">
                        (Tier 1: Cert override, Tier 2: Product cert, Tier 3: Product main)
                      </span>
                    )}
                  </label>
                  {(() => {
                    const effectiveFrom =
                      viewBatchCmsDesignId != null && String(viewBatchCmsDesignId).trim()
                        ? 'Certificate (Tier 1)'
                        : viewBatch?.product?.cmsCertificateDesignId
                          ? 'Product cert (Tier 2)'
                          : viewBatch?.product?.cmsDesignId
                            ? 'Product main (Tier 3)'
                            : 'Default (no design)';
                    return (
                      <>
                        {canEditBatchDocs ? (
                          <div className="mt-1">
                            <select
                              className="ac-input text-xs"
                              value={viewBatchCmsDesignId}
                              onChange={(e) => {
                                setViewBatchLocalError('');
                                setViewBatchCmsDesignId(e.target.value);
                              }}
                              disabled={cmsDesignsLoading}
                            >
                              <option value="">— {t('followProduct')} (Tier 2 / 3 fallback) —</option>
                              {(Array.isArray(cmsDesigns) ? cmsDesigns : []).map((d) => (
                                <option key={String(d.id)} value={String(d.id)}>
                                  {String(d.name || `Design ${d.id}`)}
                                </option>
                              ))}
                            </select>
                            <div className="mt-2 text-[10px] text-zinc-500">Effective source: {effectiveFrom}</div>
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-zinc-900">
                            {(() => {
                              const did =
                                viewBatchCmsDesignId != null && String(viewBatchCmsDesignId).trim()
                                  ? String(viewBatchCmsDesignId)
                                  : null;
                              const d = did
                                ? (Array.isArray(cmsDesigns) ? cmsDesigns : []).find((x) => String(x.id) === did)
                                : null;
                              const name = d ? String(d.name) : `Design #${did}`;
                              return did ? name : `${String(viewBatch?.product?.name || t('notSet'))} — Effective: ${effectiveFrom}`;
                            })()}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-semibold text-zinc-600">{t('authCertificate')}</div>
                  <div className="mt-1 text-xs text-zinc-900">{resolveBatchAuthCertificate(viewBatch)}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div className="text-[11px] font-semibold text-zinc-600">{t('supportingCertificates')}</div>
                  {canEditBatchDocs ? (
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                      onClick={async () => {
                        try {
                          setViewBatchLocalError('');
                          const dummyKey = `custom_${Date.now()}`;
                          const fileInput = document.createElement('input');
                          fileInput.type = 'file';
                          let resolved = false;
                          fileInput.onchange = async () => {
                            if (resolved) return;
                            resolved = true;
                            const file = fileInput.files?.[0];
                            if (!file) return;
                            try {
                              setViewBatchDocUploading((prev) => ({ ...prev, [dummyKey]: true }));
                              const uploaded = await uploadMedia({ file });
                              const mediaUrl = String(uploaded?.url || '').trim();
                              if (!mediaUrl) throw new Error(tRaw('operationFailed'));
                              const updated = await updateBatchDocuments({ batchId: viewBatch.id, documents: { [dummyKey]: mediaUrl } });
                              if (updated) setViewBatch(updated);
                            } catch (err) {
                              setViewBatchLocalError(err?.message || tRaw('operationFailed'));
                            } finally {
                              setViewBatchDocUploading((prev) => ({ ...prev, [dummyKey]: false }));
                            }
                          };
                          fileInput.click();
                          setTimeout(() => {
                            if (!resolved && !fileInput.files?.length) resolved = true;
                          }, 60000);
                        } catch (err) {
                          setViewBatchLocalError(err?.message || tRaw('operationFailed'));
                        }
                      }}
                    >
                      + {t('add')} Custom Upload
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {(() => {
                    const existing = (Array.isArray(viewBatch?.documents) ? viewBatch.documents : []).map((d) => ({
                      key: String(d?.docType || '').trim(),
                      mediaUrl: String(d?.mediaUrl || '').trim(),
                      uploadedAt: d?.uploadedAt || null
                    }));

                    const defaultKeys = DEFAULT_SUPPORTING_TYPES.map((d) => d.key);
                    const rows = [...existing];

                    if (rows.length === 0) {
                      return <div className="text-[11px] text-zinc-500">{t('notUploaded')}</div>;
                    }

                    return rows.map((row, idx) => {
                      const docKey = row.key || `view-doc-${idx}`;
                      const url = String(row?.mediaUrl || '').trim();
                      const viewUrl = url ? resolvePublicMediaUrl(url) : '';
                      const uploading = Boolean(viewBatchDocUploading?.[docKey]);
                      const isDefault = defaultKeys.includes(docKey);
                      return (
                        <div key={`${docKey}-${idx}`} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:flex-1 min-w-0">
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-zinc-500">
                                {isDefault ? 'Doc type' : 'Custom key'}:
                              </div>
                              <div className="text-xs font-semibold text-zinc-900 truncate">
                                {getDocTypeLabel(docKey)}
                              </div>
                              {row?.uploadedAt ? (
                                <div className="mt-1 text-[10px] text-zinc-500">
                                  Uploaded: {formatDateTime(row.uploadedAt)}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                              {viewUrl ? (
                                <a href={viewUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold underline truncate block">
                                  {viewUrl}
                                </a>
                              ) : (
                                <div className="text-[11px] text-zinc-500">{t('notUploaded')}</div>
                              )}
                              {canEditBatchDocs ? (
                                <label className="ac-btn ac-btn-soft shrink-0 px-3 py-2 text-xs">
                                  {uploading ? t('uploading') : t('upload')}
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      try {
                                        setViewBatchLocalError('');
                                        setViewBatchDocUploading((prev) => ({ ...prev, [docKey]: true }));
                                        const uploaded = await uploadMedia({ file });
                                        const mediaUrl = String(uploaded?.url || '').trim();
                                        if (!mediaUrl) throw new Error(tRaw('operationFailed'));
                                        const updated = await updateBatchDocuments({ batchId: viewBatch.id, documents: { [docKey]: mediaUrl } });
                                        if (updated) setViewBatch(updated);
                                      } catch (err) {
                                        setViewBatchLocalError(err?.message || tRaw('operationFailed'));
                                      } finally {
                                        setViewBatchDocUploading((prev) => ({ ...prev, [docKey]: false }));
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                </label>
                              ) : null}
                            </div>
                          </div>
                          {canEditBatchDocs && url && !isDefault ? (
                            <button
                              type="button"
                              className="ac-btn ac-btn-soft ac-btn-soft-danger shrink-0 px-2 py-2 text-xs"
                              title="Remove custom certificate"
                              onClick={async () => {
                                if (!window.confirm(`Remove "${docKey}"?`)) return;
                                try {
                                  setViewBatchLocalError('');
                                  setViewBatchDocUploading((prev) => ({ ...prev, [docKey]: true }));
                                  const updated = await updateBatchDocuments({ batchId: viewBatch.id, documents: { [docKey]: '' } });
                                  if (updated) setViewBatch(updated);
                                } catch (err) {
                                  setViewBatchLocalError(err?.message || tRaw('operationFailed'));
                                } finally {
                                  setViewBatchDocUploading((prev) => ({ ...prev, [docKey]: false }));
                                }
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {canEditBatchDocs ? (
                <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-3">
                  <button
                    type="button"
                    className="ac-btn ac-btn-primary px-4 py-2 text-xs"
                    disabled={viewBatchSaving || loading}
                    onClick={async () => {
                      try {
                        setViewBatchLocalError('');
                        setViewBatchSaving(true);
                        const pidRaw = String(viewBatchProductId || '').trim();
                        const batchPatch = {};
                        if (pidRaw) batchPatch.productId = Number(pidRaw);
                        else if (viewBatch.productId != null) batchPatch.productId = null;

                        let updatedBatch = viewBatch;
                        if (Object.keys(batchPatch).length > 0) {
                          updatedBatch =
                            (await updateBatch({ batchId: viewBatch.id, patch: batchPatch })) || updatedBatch;
                          setViewBatch(updatedBatch);
                        }

                        const certId = String(updatedBatch?.certificate?.certificateId || '').trim();
                        const designRaw = String(viewBatchCmsDesignId || '').trim();
                        const designId = designRaw ? Number(designRaw) : null;
                        if (certId) {
                          const currentCertDesignId = String(updatedBatch?.certificate?.cmsDesignId ?? '').trim();
                          const desired = designRaw || '';
                          if (currentCertDesignId !== desired) {
                            await updateCertificate({
                              certificateId: certId,
                              patch: { cmsDesignId: designId }
                            });
                            const refreshed = { ...updatedBatch, certificate: { ...(updatedBatch?.certificate || {}), cmsDesignId: designId } };
                            setViewBatch(refreshed);
                          }
                        }
                        void fetchBatches({ q: '', origin: undefined, limit: 50, offset: 0 });
                      } catch (err) {
                        setViewBatchLocalError(err?.message || tRaw('operationFailed'));
                      } finally {
                        setViewBatchSaving(false);
                      }
                    }}
                  >
                    {viewBatchSaving ? t('saving') : t('saveChanges')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'production' && canProduction ? (
        <SectionShell
          badge={t('labelProductionRecord')}
          title={t('labelProductionRecord')}
          hint={`${t('exportXlsx')} • ${t('importXlsx')} • ${t('markDone')}`}
        >
          <DataTable
            sortState={productionSort}
            onSortChange={setProductionSort}
            density="compact"
            minWidth={1180}
            rows={sortedProductionRows}
            rowKey={(b) => b.id}
            loading={loading}
            loadingContent={t('loading')}
            emptyContent={
              <div>
                <div className="text-sm font-semibold text-slate-900">{t('noBatches')}</div>
                <div className="mt-1 text-sm text-slate-600">{`${t('exportXlsx')} • ${t('importXlsx')} • ${t('markDone')}`}</div>
              </div>
            }
            top={
              <div>
                <div className="text-sm font-semibold text-slate-900">{t('labelProductionRecord')}</div>
              </div>
            }
            columns={productionColumns}
            columnTools={{
              enabled: true,
              storageKey: scopedColumnKey('ac_epc_production_v3'),
              initialPinnedIds: ['batchName'],
              defaultColumnWidth: 116
            }}
          />
        </SectionShell>
      ) : null}

      {tab === 'production' && canProduction && canBatchCreate ? (
        null
      ) : null}

      {rangeOpen ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[72rem] flex-col overflow-hidden">
            <div className="mb-3 text-sm font-semibold text-zinc-900">{t('activateEpcRange')}</div>

            {rangeLocalError ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{rangeLocalError}</div> : null}

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 text-xs text-slate-600">{t('activateEpcRangeHint')}</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[180px_180px_180px_180px_minmax(0,1fr)]">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('corpCode')}</div>
                    {Array.isArray(corpCodes) && corpCodes.length > 0 ? (
                      <select
                        value={String(rangeCorpCode || corpCodes[0] || '')}
                        onChange={(e) => {
                          setRangeCorpCode(String(e.target.value || '').trim().toUpperCase());
                          setRangePreview(null);
                          setRangeSelectedEpcs(new Set());
                          setRangeLocalError('');
                        }}
                        className="ac-input"
                      >
                        {corpCodes.map((code) => (
                          <option key={String(code)} value={String(code)}>
                            {String(code)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={String(rangeCorpCode || '').toUpperCase()}
                        onChange={(e) => {
                          setRangeCorpCode(String(e.target.value || '').toUpperCase());
                          setRangePreview(null);
                          setRangeSelectedEpcs(new Set());
                          setRangeLocalError('');
                        }}
                        className="ac-input font-mono uppercase"
                        placeholder="DA01"
                      />
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('date')}</div>
                    <input
                      type="date"
                      value={rangeDate}
                      onChange={(e) => {
                        setRangeDate(String(e.target.value || '').trim());
                        setRangePreview(null);
                        setRangeSelectedEpcs(new Set());
                        setRangeLocalError('');
                      }}
                      className="ac-input"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('startRunningNo')}</div>
                    <input
                      value={rangeStartRunningNo}
                      onChange={(e) => {
                        setRangeStartRunningNo(normalizeRangeRunningInput(e.target.value));
                        setRangePreview(null);
                        setRangeSelectedEpcs(new Set());
                        setRangeLocalError('');
                      }}
                      className="ac-input font-mono"
                      inputMode="numeric"
                      placeholder="1"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">{rangeStartRunningNo ? t('runningNoPreview', { value: paddedRangeStartRunningNo }) : '\u00A0'}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('endRunningNo')}</div>
                    <input
                      value={rangeEndRunningNo}
                      onChange={(e) => {
                        setRangeEndRunningNo(normalizeRangeRunningInput(e.target.value));
                        setRangePreview(null);
                        setRangeSelectedEpcs(new Set());
                        setRangeLocalError('');
                      }}
                      className="ac-input font-mono"
                      inputMode="numeric"
                      placeholder="100"
                    />
                    <div className="mt-1 text-[11px] text-slate-500">{rangeEndRunningNo ? t('runningNoPreview', { value: paddedRangeEndRunningNo }) : '\u00A0'}</div>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-4 py-3 text-sm"
                      disabled={loading}
                      onClick={async () => {
                        try {
                          setRangeLocalError('');
                          const preview = await previewBatchImportRange({
                            corpCode: rangeCorpCode,
                            date: rangeDate,
                            startRunningNo: rangeStartRunningNo,
                            endRunningNo: rangeEndRunningNo,
                            certificateTemplateId: String(rangeAuthTemplateId || '').trim() || undefined
                          });
                          setRangePreview(preview);
                          setRangeRowValues({});
                          setRangeBatchFillValues({});
                          setRangeEntryOpen(false);
                          const defaultSelected = new Set(
                            (Array.isArray(preview?.items) ? preview.items : [])
                              .filter((row) => row?.defaultSelected)
                              .map((row) => String(row?.epcCode || '').trim())
                              .filter(Boolean)
                          );
                          setRangeSelectedEpcs(defaultSelected);
                        } catch (err) {
                          setRangePreview(null);
                          setRangeSelectedEpcs(new Set());
                          setRangeLocalError(err?.response?.data?.message || err?.message || tRaw('operationFailed'));
                        }
                      }}
                    >
                      {t('previewRange')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-semibold text-slate-900">{t('batchInformation')}</div>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('product')}</div>
                        <select value={rangeProductId} onChange={(e) => setRangeProductId(e.target.value)} className="ac-input">
                          <option value="">{t('select')}</option>
                          {(Array.isArray(products) ? products : []).map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {String(p?.sku || p?.code || '').trim()
                                ? `${String(p.sku || p.code).trim()} — ${String(p?.name || '').trim() || '-'}`
                                : String(p?.name || '').trim() || '-'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('authCertificate')}</div>
                        <select
                          value={rangeAuthTemplateId}
                          onChange={(e) => {
                            setRangeAuthTemplateId(e.target.value);
                            setRangePreview(null);
                            setRangeSelectedEpcs(new Set());
                          }}
                          className="ac-input"
                        >
                          <option value="">{t('select')}</option>
                          {authTemplates.map((tpl) => (
                            <option key={tpl.id} value={String(tpl.id)}>
                              {String(tpl?.certificateId || '').trim() ? `${tpl.certificateId} — ${tpl.name}` : tpl.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('landingPageDesign')}</div>
                        <select
                          value={rangeCmsDesignId}
                          onChange={(e) => setRangeCmsDesignId(e.target.value)}
                          className="ac-input"
                          disabled={cmsDesignsLoading}
                        >
                          <option value="">{t('useProductLandingDesign')}</option>
                          {(Array.isArray(cmsDesigns) ? cmsDesigns : []).map((d) => (
                            <option key={String(d.id)} value={String(d.id)}>
                              {String(d.name || `Design #${d.id}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="mb-2 text-sm font-semibold text-slate-900">{t('supportingCertificates')}</div>
                    <div className="space-y-2">
                      {rangeDocRows.map((row, idx) => {
                        const rowKey = `range-doc-${idx}`;
                        const keyVal = String(row?.key || '').trim();
                        const urlVal = String(row?.url || '').trim();
                        const uploadingKey = keyVal || `_idx_${idx}`;
                        const uploading = Boolean(rangeDocUploading?.[uploadingKey]);
                        const viewUrl = urlVal ? resolvePublicMediaUrl(urlVal) : '';
                        const isDefault = DEFAULT_SUPPORTING_TYPES.some((d) => d.key === keyVal);
                        return (
                          <div key={rowKey} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:flex-1 min-w-0">
                              <div className="w-full sm:max-w-[200px] min-w-0">
                                <label className="text-[10px] font-semibold text-zinc-500">Doc name {isDefault ? '(preset)' : '(optional)'}:</label>
                                <input
                                  type="text"
                                  className="ac-input mt-1 w-full px-2 py-2 text-xs"
                                  value={row.key}
                                  placeholder="e.g. halal_cert, sop_docs..."
                                  onChange={(e) => {
                                    setRangeLocalError('');
                                    const v = e.target.value;
                                    setRangeDocRows((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...(next[idx] || {}), key: v };
                                      return next;
                                    });
                                  }}
                                />
                              </div>
                              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                <div className="text-[11px] text-zinc-700 min-w-0">
                                  {viewUrl ? (
                                    <a href={viewUrl} target="_blank" rel="noreferrer" className="font-semibold underline truncate block">
                                      {viewUrl}
                                    </a>
                                  ) : (
                                    <span className="text-zinc-500">{t('notUploaded')}</span>
                                  )}
                                </div>
                                <label className="ac-btn ac-btn-soft shrink-0 px-3 py-2 text-xs">
                                  {uploading ? t('uploading') : t('upload')}
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      try {
                                        setRangeLocalError('');
                                        setRangeDocUploading((prev) => ({ ...prev, [uploadingKey]: true }));
                                        const uploaded = await uploadMedia({ file });
                                        const mediaUrl = String(uploaded?.url || '').trim();
                                        if (!mediaUrl) throw new Error(tRaw('operationFailed'));
                                        setRangeDocRows((prev) => {
                                          const next = [...prev];
                                          const cur = { ...(next[idx] || {}) };
                                          if (isAutoPlaceholderDocKey(cur.key, idx)) {
                                            const taken = new Set(next.map((r, j) => (j === idx ? '' : String(r?.key || '').trim())).filter(Boolean));
                                            let base = cleanFilenameToDocKey(file.name, 'supporting');
                                            let candidate = base;
                                            let suffix = 2;
                                            while (taken.has(candidate)) {
                                              candidate = `${base}_${suffix}`;
                                              suffix += 1;
                                            }
                                            cur.key = candidate;
                                          }
                                          cur.url = mediaUrl;
                                          next[idx] = cur;
                                          return next;
                                        });
                                      } catch (err) {
                                        setRangeLocalError(err?.message || tRaw('operationFailed'));
                                      } finally {
                                        setRangeDocUploading((prev) => ({ ...prev, [uploadingKey]: false }));
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="ac-btn ac-btn-soft ac-btn-soft-danger shrink-0 px-2 py-2 text-xs"
                              title="Remove this entry"
                              onClick={() => {
                                setRangeLocalError('');
                                setRangeDocRows((prev) => {
                                  const next = [...prev];
                                  next.splice(idx, 1);
                                  return next;
                                });
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex justify-start">
                      <button
                        type="button"
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        onClick={() =>
                          setRangeDocRows((prev) => {
                            const next = Array.isArray(prev) ? [...prev] : [];
                            const existingKeys = new Set(next.map((r) => String(r?.key || '').trim()).filter(Boolean));
                            let i = 1;
                            let autoKey = '';
                            while (!autoKey || existingKeys.has(autoKey)) {
                              autoKey = `supporting_${i}`;
                              i += 1;
                            }
                            next.push({ key: autoKey, url: '' });
                            return next;
                          })
                        }
                      >
                        + {t('add')} Custom
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{t('previewResult')}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {rangePreview ? `${rangePreview.startEpc} - ${rangePreview.endEpc}` : rangePreviewLabel || t('activateEpcRangeHint')}
                        </div>
                      </div>
                      {rangePreview ? (
                        <div className="text-right text-xs text-slate-600">
                          <div>{t('selectedEpcsCount', { value: rangeSelectedEpcs.size })}</div>
                          {rangePreview?.targetCertificateId ? <div className="mt-1 font-mono">{rangePreview.targetCertificateId}</div> : null}
                        </div>
                      ) : null}
                    </div>

                    {rangePreview ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-[11px] font-semibold text-slate-500">{t('rowsLabel')}</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{String(rangePreview?.summary?.total ?? 0)}</div>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <div className="text-[11px] font-semibold text-emerald-700">{t('selectableEpcs')}</div>
                            <div className="mt-1 text-sm font-semibold text-emerald-900">{String(rangePreview?.summary?.selectable ?? 0)}</div>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <div className="text-[11px] font-semibold text-amber-700">{t('alreadyAssignedEpcs')}</div>
                            <div className="mt-1 text-sm font-semibold text-amber-900">{String(rangePreview?.summary?.alreadyAssigned ?? 0)}</div>
                          </div>
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <div className="text-[11px] font-semibold text-rose-700">{t('conflictingEpcs')}</div>
                            <div className="mt-1 text-sm font-semibold text-rose-900">{String(rangePreview?.summary?.conflicts ?? 0)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-[11px] font-semibold text-slate-500">{t('missingEpcLabel')}</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{String(rangePreview?.summary?.missing ?? 0)}</div>
                          </div>
                          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                            <div className="text-[11px] font-semibold text-brand-700">{t('selectAllReady')}</div>
                            <button
                              type="button"
                              className="mt-2 ac-btn ac-btn-soft px-3 py-2 text-xs"
                              disabled={selectableRangeRows.length === 0}
                              onClick={handleRangeToggleAll}
                            >
                              {allSelectableRangeChecked ? t('clearSelection') : t('selectAll')}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{t('dataEntryTitle')}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {t('dataEntryHint')}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                              onClick={() => setRangeEntryOpen(true)}
                            >
                              {t('openDataEntry')}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                        {t('previewRange')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-zinc-200 bg-white pt-4">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeRange}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={loading || !rangePreview || rangeSelectedEpcs.size === 0 || Object.values(rangeDocUploading || {}).some(Boolean)}
                onClick={async () => {
                  try {
                    setRangeLocalError('');
                    if (!rangePreview) throw new Error(t('previewRange'));
                    if (!String(rangeProductId || '').trim()) throw new Error(t('selectProduct'));
                    if (rangeSelectedEpcs.size === 0) throw new Error(t('noEpcSelected'));

                    const documents = buildDocumentsPayload(rangeDocRows);
                    const res = await submitBatchImportRange({
                      corpCode: rangeCorpCode,
                      date: rangeDate,
                      startRunningNo: rangeStartRunningNo,
                      endRunningNo: rangeEndRunningNo,
                      epcCodes: Array.from(rangeSelectedEpcs),
                      rowValues: Array.from(rangeSelectedEpcs).reduce((acc, epcCode) => {
                        acc[epcCode] = { ...(rangeRowValues?.[epcCode] || {}) };
                        return acc;
                      }, {}),
                      productId: String(rangeProductId || '').trim(),
                      certificateTemplateId: String(rangeAuthTemplateId || '').trim() || undefined,
                      documents
                    });

                    setImportLastResult(res || null);

                    const certId = String(res?.certificateId || '').trim();
                    const cmsDesignRaw = String(rangeCmsDesignId || '').trim();
                    if (certId && cmsDesignRaw) {
                      try {
                        const designId = Number(cmsDesignRaw);
                        if (Number.isFinite(designId) && designId > 0) {
                          await updateCertificate({
                            certificateId: certId,
                            patch: { cmsDesignId: designId }
                          });
                        }
                      } catch (_ignore) {
                        // ignore non-critical landing design failure after successful range activation
                      }
                    }

                    if (Array.isArray(res?.batchIds) && res.batchIds.length === 1) {
                      setTab('batches');
                      setListBatchId(String(res.batchIds[0]));
                      setListOffset(0);
                    }

                    setActivateCertConfirmMeta({
                      source: 'batchImportRange',
                      batchId: Array.isArray(res?.batchIds) && res.batchIds.length === 1 ? Number(res.batchIds[0]) : null,
                      description: `${String(res?.rows ?? rangeSelectedEpcs.size)} EPC row(s) processed from the selected range.`
                    });
                    closeRange();
                    setActivateCertConfirmOpen(true);
                  } catch (err) {
                    setRangeLocalError(err?.response?.data?.message || err?.message || tRaw('operationFailed'));
                  }
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rangeOpen && rangeEntryOpen && rangePreview ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[88rem] flex-col overflow-hidden">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{t('dataEntryTitle')}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {rangePreview ? `${rangePreview.startEpc} - ${rangePreview.endEpc}` : t('dataEntryHint')}
                </div>
              </div>
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setRangeEntryOpen(false)}>
                {t('close')}
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <div>{t('selectedEpcsCount', { value: rangeSelectedEpcs.size })}</div>
              <div>{t('fieldsConfigured')}: {String(rangeFieldSchema.length)}</div>
            </div>

            {rangeFieldSchema.length > 0 ? (
              <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs text-brand-900">
                {t('dataEntryModeHint')}
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                {t('noBatchFieldsConfigured')}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden">
              <EpcDynamicEntryGrid
                t={t}
                fieldSchema={rangeFieldSchema}
                previewItems={rangePreviewItems}
                selectedEpcs={rangeSelectedEpcs}
                allSelectableChecked={allSelectableRangeChecked}
                selectableRows={selectableRangeRows}
                rowValues={rangeRowValues}
                batchFillValues={rangeBatchFillValues}
                onToggleAll={handleRangeToggleAll}
                onToggleRow={handleRangeToggleRow}
                onChangeRowValue={handleRangeRowValueChange}
                onChangeBatchFill={handleRangeBatchFillChange}
                onApplyBatchFill={handleApplyRangeBatchFill}
              />
            </div>
          </div>
        </div>
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
                        setImportLocalError(err?.response?.data?.message || err?.message || tRaw('operationFailed'));
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                {importPreview ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600">{t('rowsTotal')}</div>
                      <div className="mt-0.5 font-mono">{String(Array.isArray(importPreview?.rows) ? importPreview.rows.length : Number(importPreview?.rows) || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600">{t('uniqueEpcLabel')}</div>
                      <div className="mt-0.5 font-mono">{String(importPreview?.uniqueEpcs || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600">{t('existingEpcs')}</div>
                      <div className="mt-0.5 font-mono">{String(importPreview?.existingEpcs || 0)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-600">{t('fieldsConfigured')}</div>
                      <div className="mt-0.5 font-mono">{String(importPreviewFieldSchema.length)}</div>
                    </div>
                  </div>
                ) : null}
                {importPreviewFieldPresenceRows.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-3">
                    <div className="mb-2 text-[11px] font-semibold text-zinc-600">{t('templateFieldCoverage')}</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {importPreviewFieldPresenceRows.map((row) => (
                        <div key={row.fieldKey} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-[11px] font-semibold text-slate-700">{row.label}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">{row.fieldKey}</div>
                          <div className="mt-1 font-mono text-sm text-slate-900">
                            {row.value} {t('fieldsPopulated')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {importPreview?.missingSample?.length ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {t('missingSampleLabel')}: {String(importPreview.missingSample.join(', '))}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('product')}</div>
                <select value={importProductId} onChange={(e) => setImportProductId(e.target.value)} className="ac-input">
                  <option value="">{t('select')}</option>
                  {(Array.isArray(products) ? products : []).map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {String(p?.sku || p?.code || '').trim()
                        ? `${String(p.sku || p.code).trim()} — ${String(p?.name || '').trim() || '-'}`
                        : String(p?.name || '').trim() || '-'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('authCertificate')}</div>
                <select value={importAuthTemplateId} onChange={(e) => setImportAuthTemplateId(e.target.value)} className="ac-input">
                  <option value="">{t('select')}</option>
                  {authTemplates.map((tpl) => (
                    <option key={tpl.id} value={String(tpl.id)}>
                      {String(tpl?.certificateId || '').trim() ? `${tpl.certificateId} — ${tpl.name}` : tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('landingPageDesign')}</div>
                <select
                  value={importCmsDesignId}
                  onChange={(e) => setImportCmsDesignId(e.target.value)}
                  className="ac-input"
                  disabled={cmsDesignsLoading}
                >
                  <option value="">{t('useProductLandingDesign')}</option>
                  {(Array.isArray(cmsDesigns) ? cmsDesigns : []).map((d) => (
                    <option key={String(d.id)} value={String(d.id)}>
                      {String(d.name || `Design #${d.id}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold text-zinc-600">{t('supportingCertificates')}</div>

                <div className="space-y-2">
                  {importDocRows.map((row, idx) => {
                    const rowKey = `imp-doc-${idx}`;
                    const keyVal = String(row?.key || '').trim();
                    const urlVal = String(row?.url || '').trim();
                    const uploadingKey = keyVal || `_idx_${idx}`;
                    const uploading = Boolean(importDocUploading?.[uploadingKey]);
                    const viewUrl = urlVal ? resolvePublicMediaUrl(urlVal) : '';
                    const isDefault = DEFAULT_SUPPORTING_TYPES.some((d) => d.key === keyVal);
                    return (
                      <div key={rowKey} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:flex-1 min-w-0">
                          <div className="w-full sm:max-w-[200px] min-w-0">
                            <label className="text-[10px] font-semibold text-zinc-500">
                              Doc name {isDefault ? '(preset)' : '(optional)'}:
                            </label>
                            <input
                              type="text"
                              className="ac-input mt-1 w-full px-2 py-2 text-xs"
                              value={row.key}
                              placeholder={`e.g. halal_cert, sop_docs...`}
                              onChange={(e) => {
                                setImportLocalError('');
                                const v = e.target.value;
                                setImportDocRows((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...(next[idx] || {}), key: v };
                                  return next;
                                });
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                            <div className="text-[11px] text-zinc-700 min-w-0">
                              {viewUrl ? (
                                <a href={viewUrl} target="_blank" rel="noreferrer" className="font-semibold underline truncate block">
                                  {viewUrl}
                                </a>
                              ) : (
                                <span className="text-zinc-500">{t('notUploaded')}</span>
                              )}
                            </div>
                            <label className="ac-btn ac-btn-soft shrink-0 px-3 py-2 text-xs">
                              {uploading ? t('uploading') : t('upload')}
                              <input
                                type="file"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    setImportLocalError('');
                                    setImportDocUploading((prev) => ({ ...prev, [uploadingKey]: true }));
                                    const uploaded = await uploadMedia({ file });
                                    const mediaUrl = String(uploaded?.url || '').trim();
                                    if (!mediaUrl) throw new Error(tRaw('operationFailed'));
                                    setImportDocRows((prev) => {
                                      const next = [...prev];
                                      const cur = { ...(next[idx] || {}) };
                                      if (isAutoPlaceholderDocKey(cur.key, idx)) {
                                        const taken = new Set(
                                          next.map((r, j) => (j === idx ? '' : String(r?.key || '').trim())).filter(Boolean)
                                        );
                                        let base = cleanFilenameToDocKey(file.name, 'supporting');
                                        let candidate = base;
                                        let suffix = 2;
                                        while (taken.has(candidate)) {
                                          candidate = `${base}_${suffix}`;
                                          suffix += 1;
                                        }
                                        cur.key = candidate;
                                      }
                                      cur.url = mediaUrl;
                                      next[idx] = cur;
                                      return next;
                                    });
                                  } catch (err) {
                                    setImportLocalError(err?.message || tRaw('operationFailed'));
                                  } finally {
                                    setImportDocUploading((prev) => ({ ...prev, [uploadingKey]: false }));
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ac-btn ac-btn-soft ac-btn-soft-danger shrink-0 px-2 py-2 text-xs"
                          title="Remove this entry"
                          onClick={() => {
                            setImportLocalError('');
                            setImportDocRows((prev) => {
                              const next = [...prev];
                              next.splice(idx, 1);
                              return next;
                            });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex justify-start">
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                    onClick={() =>
                      setImportDocRows((prev) => {
                        const next = Array.isArray(prev) ? [...prev] : [];
                        const existingKeys = new Set(next.map((r) => String(r?.key || '').trim()).filter(Boolean));
                        let i = 1;
                        let autoKey = '';
                        while (!autoKey || existingKeys.has(autoKey)) {
                          autoKey = `supporting_${i}`;
                          i += 1;
                        }
                        next.push({ key: autoKey, url: '' });
                        return next;
                      })
                    }
                  >
                    + {t('add')} Custom
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={closeImport}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                disabled={loading || Object.values(importDocUploading || {}).some(Boolean)}
                onClick={async () => {
                  try {
                    setImportLocalError('');
                    if (!importBase64) throw new Error(t('uploadXlsxFirst'));
                    if (!importPreview) throw new Error(t('uploadXlsxFirst'));
                    if (!String(importProductId || '').trim()) throw new Error(t('selectProduct'));
                    const missingCount = Number(importPreview?.missingEpcs) || 0;
                    if (missingCount > 0) throw new Error(t('missingEpcError'));

                    const documents = {};
                    const usedKeys = new Set();
                    let autoIdx = 1;
                    for (const row of importDocRows) {
                      const v = String(row?.url || '').trim();
                      if (!v) continue;
                      let k = String(row?.key || '').trim();
                      if (!k || /^supporting_\d+$/.test(k) || usedKeys.has(k)) {
                        const fromUrl = cleanFilenameToDocKey(v.split('/').pop() || v.split('\\').pop() || '', 'supporting');
                        let candidate = fromUrl;
                        let suffix = autoIdx;
                        while (usedKeys.has(candidate)) {
                          candidate = `${fromUrl}_${suffix}`;
                          suffix += 1;
                        }
                        autoIdx = suffix + 1;
                        k = candidate;
                      }
                      usedKeys.add(k);
                      documents[k] = v;
                    }

                    const res = await submitBatchImport({
                      batchId: null,
                      base64: importBase64,
                      productId: String(importProductId || '').trim(),
                      certificateTemplateId: String(importAuthTemplateId || '').trim() || undefined,
                      documents
                    });
                    setImportLastResult(res || null);

                    const bid = Array.isArray(res?.batchIds) && res.batchIds.length === 1 ? Number(res.batchIds[0]) : null;
                    const realBid = Number.isFinite(bid) && bid > 0 ? bid : Number(res?.batchId || res?.batch?.id || 0);
                    const tplCertId = String(res?.batch?.certificateTemplate?.certificateId || '').trim() || '';
                    const cmsDesignRaw = String(importCmsDesignId || '').trim();
                    if (realBid > 0 && tplCertId && cmsDesignRaw) {
                      try {
                        const designId = Number(cmsDesignRaw);
                        if (Number.isFinite(designId) && designId > 0) {
                          await updateCertificate({
                            certificateId: tplCertId,
                            patch: { cmsDesignId: designId }
                          });
                        }
                      } catch (_ignore) {
                        // ignore non-critical landing design assign failure on import success
                      }
                    }

                    if (realBid > 0) {
                      setTab('batches');
                      setListBatchId(String(realBid));
                      setListOffset(0);
                    }
                    const rows = Number(res?.rows || 0);
                    setActivateCertConfirmMeta({
                      source: 'batchImport',
                      batchId: realBid > 0 ? realBid : null,
                      description: rows > 0 ? `Batch import successful. ${rows} EPC row(s) registered with the configured dynamic fields.` : 'Batch import successful.'
                    });
                    closeImport();
                    setActivateCertConfirmOpen(true);
                  } catch (err) {
                    setImportLocalError(err?.response?.data?.message || err?.message || tRaw('operationFailed'));
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
                {Array.isArray(corpCodes) && corpCodes.length > 0 ? (
                  <select
                    value={String(generateCorpPrefix || corpCodes[0] || '')}
                    onChange={(e) => setGenerateCorpPrefix(e.target.value)}
                    className="ac-input px-3 py-2 text-xs"
                  >
                    {corpCodes.map((code) => (
                      <option key={String(code)} value={String(code)}>
                        {String(code)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      value={String(generateCorpPrefix || '').toUpperCase()}
                      onChange={(e) =>
                        setGenerateCorpPrefix(
                          String(e.target.value || '')
                            .toUpperCase()
                            .replace(/[^0-9A-F]/g, '')
                            .slice(0, 8)
                        )
                      }
                      className="ac-input px-3 py-2 text-xs font-mono"
                      placeholder="e.g. DA03, AB01, FF00, 1A2B"
                      pattern="^[0-9A-F]{2,8}$"
                      maxLength={8}
                    />
                    <div className="mt-1 text-[10px] text-zinc-500">
                      Hexadecimal sahaja (0–9, A–F), panjang 2–8 aksara. Contoh: DA03, AB01, 1A2B3C
                    </div>
                  </>
                )}
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
                disabled={
                  loading ||
                  !batchQty ||
                  (Array.isArray(corpCodes) && corpCodes.length === 0 &&
                    !/^[0-9A-F]{2,8}$/i.test(String(generateCorpPrefix || '').trim()))
                }
                onClick={async () => {
                  const isWhitelistMode = Array.isArray(corpCodes) && corpCodes.length > 0;
                  const corpPrefix = String(
                    generateCorpPrefix || (isWhitelistMode && corpCodes[0] ? corpCodes[0] : '')
                  ).trim().toUpperCase();
                  if (!isWhitelistMode && !/^[0-9A-F]{2,8}$/.test(corpPrefix)) {
                    alert('Corp code mestilah format hex (0-9, A-F), panjang 2-8 aksara');
                    return;
                  }
                  const created = await generateBatch({ corpPrefix, batchQty, remark: String(remark || '').trim() || undefined });
                  if (created?.batch?.id != null) await exportBatchImportTemplateXlsx();
                  setGenerateOpen(false);
                  setBatchQty(1);
                  setRemark('');
                  setGenerateCorpPrefix(isWhitelistMode && corpCodes[0] ? corpCodes[0] : '');
                  setListOffset(0);
                  await fetchItems({
                    q: listQuery,
                    status: listStatus || undefined,
                    createdFrom: createdFrom || undefined,
                    createdTo: createdTo || undefined,
                    batchId: String(listBatchId || '').trim() || undefined,
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
