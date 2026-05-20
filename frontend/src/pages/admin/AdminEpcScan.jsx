import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useT } from '../../i18n/useT';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { createAdminApi } from '../../utils/adminApi';
import { hasPermission } from '../../utils/permissions';
import DataTable from '../../components/ui/DataTable';

function nextMissingStep(item) {
  if (!item?.netWeight) return 'netWeight';
  if (!item?.caiqNumber) return 'caiqNumber';
  return 'epc';
}

function stripPrefix(raw, prefixes) {
  const s = String(raw || '').trim();
  for (const p of prefixes) {
    const re = new RegExp(`^${p}\\s*[:\\-]?\\s*`, 'i');
    if (re.test(s)) return s.replace(re, '').trim();
  }
  return s;
}

function hasAnyDigit(s) {
  return /\d/.test(String(s || ''));
}

function formatNetWeightValue(input) {
  if (input == null) return '';
  const s = String(input ?? '').trim();
  if (!s) return '';
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(g)?$/i);
  if (m) return `${m[1]} g`;
  return s;
}

function isSkipToken(raw) {
  const s = String(raw || '').trim().toUpperCase();
  return s === 'SKIP' || s === 'NEXT' || s === 'NA' || s === 'N/A';
}

function normalizeScanToken(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function looksLikeEpcCode(raw) {
  const s = normalizeScanToken(raw);
  if (!s) return false;
  if (!/[A-Z]/.test(s)) return false;
  if (s.length < 16) return false;
  if (!/\d{12}$/.test(s)) return false;
  const mmyy = s.slice(-12, -8);
  if (!/^\d{4}$/.test(mmyy)) return false;
  const mm = Number(mmyy.slice(0, 2));
  if (!Number.isFinite(mm) || mm < 1 || mm > 12) return false;
  return true;
}

export default function AdminEpcScan() {
  const { t } = useT();
  const location = useLocation();
  const inputRef = useRef(null);
  const scannedRef = useRef(new Set());
  const scanIdleTimerRef = useRef(null);
  const handleScanRef = useRef(null);
  const scanLastInputAtRef = useRef(0);
  const scanBurstStartAtRef = useRef(0);
  const scanPrevLenRef = useRef(0);
  const scanAutoModeRef = useRef(false);
  const amendNetWeightRef = useRef(null);
  const amendProductionDateRef = useRef(null);
  const amendCaiqRef = useRef(null);

  const { token, user } = useAdminAuthStore((s) => ({ token: s.token, user: s.user }));
  const role = user?.role || 'admin';
  const perms = user?.permissions || [];
  const canScanAccess = role === 'super_admin' || hasPermission(perms, 'epc.write') || hasPermission(perms, 'epc.scan.access') || hasPermission(perms, '*');
  const canOverride = role === 'super_admin' || role === 'admin' || hasPermission(perms, 'epc.override') || hasPermission(perms, '*');
  const canProduction = role === 'super_admin' || role === 'admin' || hasPermission(perms, 'epc.production.access') || hasPermission(perms, '*');

  const api = useMemo(() => createAdminApi({ token }), [token]);

  const [viewTab, setViewTab] = useState('batch');
  const [step, setStep] = useState('epc');
  const [scanValue, setScanValue] = useState('');
  const [current, setCurrent] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editNetWeight, setEditNetWeight] = useState('');
  const [editProductionDate, setEditProductionDate] = useState('');
  const [editCaiq, setEditCaiq] = useState('');
  const [topError, setTopError] = useState('');
  const [topHint, setTopHint] = useState('');
  const [amendOpen, setAmendOpen] = useState(false);

  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batchItems, setBatchItems] = useState([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const batchLimit = 50;
  const [batchQuery, setBatchQuery] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupOffset, setGroupOffset] = useState(0);
  const groupLimit = 50;
  const [groupStatus, setGroupStatus] = useState('OPEN');
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [assignProductId, setAssignProductId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const selectedRow = rows.find((r) => String(r.id) === String(selectedId)) || null;

  const productOptions = useMemo(() => {
    return (Array.isArray(products) ? products : []).slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }, [products]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const batchId = String(params.get('batchId') || '').trim();
    if (!batchId) return;
    setSelectedBatchId(batchId);
    setBatchOffset(0);
  }, [location.search]);

  useEffect(() => {
    if (!amendOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setAmendOpen(false);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [amendOpen]);

  useEffect(() => {
    if (!amendOpen) return;
    window.setTimeout(() => {
      if (!selectedRow?.id) return;
      const focusEl = amendNetWeightRef.current || amendCaiqRef.current;
      focusEl?.focus?.();
    }, 0);
  }, [amendOpen, selectedRow?.id]);

  const clearScanIdleTimer = () => {
    if (scanIdleTimerRef.current) {
      window.clearTimeout(scanIdleTimerRef.current);
      scanIdleTimerRef.current = null;
    }
  };

  const upsertRow = (item, extra) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => String(r.id) === String(item.id));
      const nextRow = {
        ...(idx >= 0 ? prev[idx] : {}),
        ...item,
        saving: false,
        rowError: '',
        lastSavedAt: Date.now(),
        ...(extra || {})
      };
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = nextRow;
        return next;
      }
      return [nextRow, ...prev];
    });
  };

  const selectRow = (item) => {
    setSelectedId(item?.id ?? null);
    setCurrent(item || null);
    setEditNetWeight(item?.netWeight ? String(item.netWeight) : '');
    setEditProductionDate(item?.productionDate ? new Date(item.productionDate).toISOString().slice(0, 10) : '');
    setEditCaiq(item?.caiqNumber ? String(item.caiqNumber) : '');
    setStep(nextMissingStep(item));
    setTopHint('');
    setTopError('');
    inputRef.current?.focus();
  };

  const lookupEpc = async (epcCode) => {
    const res = await api.get('/epc/items/by-epc', { params: { epc: epcCode } });
    return res?.data?.data || null;
  };

  const fetchBatches = useCallback(async () => {
    const res = await api.get('/epc/batches', { params: { limit: 50, offset: 0 } });
    const data = res?.data?.data || {};
    const list = Array.isArray(data.items) ? data.items : [];
    setBatches(list);
    setSelectedBatchId((prev) => {
      if (prev) return prev;
      return list[0]?.id ? String(list[0].id) : '';
    });
  }, [api]);

  const fetchBatchItems = useCallback(
    async ({ batchId, q, pending, limit, offset }) => {
      const res = await api.get('/epc/items', {
        params: {
          batchId: batchId ? Number(batchId) : undefined,
          q: q || undefined,
          pending: pending ? 1 : undefined,
          limit,
          offset
        }
      });
      return res?.data?.data || null;
    },
    [api]
  );

  const fetchGroups = useCallback(
    async ({ status, limit, offset }) => {
      const res = await api.get('/epc/scan-groups', {
        params: {
          status: status || undefined,
          limit,
          offset
        }
      });
      return res?.data?.data || null;
    },
    [api]
  );

  const fetchGroupDetail = useCallback(
    async (id) => {
      const res = await api.get(`/epc/scan-groups/${Number(id)}`);
      return res?.data?.data || null;
    },
    [api]
  );

  const patchItem = async (itemId, patch) => {
    const body = { ...(patch || {}) };
    const res = await api.patch(`/epc/items/${Number(itemId)}/production`, body);
    return res?.data?.data || null;
  };

  const skipCaiq = () => {
    setCurrent(null);
    setSelectedId(null);
    setStep('epc');
    setTopError('');
    setTopHint(t('scanCaiqSkipped'));
    inputRef.current?.focus();
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setBatchLoading(true);
        await fetchBatches();
      } catch (e) {
        if (!mounted) return;
        void e;
      } finally {
        if (mounted) setBatchLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [fetchBatches]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!selectedBatchId) return;
      try {
        setBatchLoading(true);
        const data = await fetchBatchItems({
          batchId: selectedBatchId,
          q: batchQuery,
          pending: pendingOnly,
          limit: batchLimit,
          offset: batchOffset
        });
        if (!mounted) return;
        setBatchItems(Array.isArray(data?.items) ? data.items : []);
        setBatchTotal(Number(data?.total) || 0);
      } catch (e) {
        if (!mounted) return;
        void e;
        setBatchItems([]);
        setBatchTotal(0);
      } finally {
        if (mounted) setBatchLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [selectedBatchId, batchQuery, pendingOnly, batchOffset, fetchBatchItems]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (viewTab !== 'groups') return;
      try {
        setGroupLoading(true);
        const data = await fetchGroups({ status: groupStatus, limit: groupLimit, offset: groupOffset });
        if (!mounted) return;
        setGroups(Array.isArray(data?.items) ? data.items : []);
        setGroupTotal(Number(data?.total) || 0);
      } catch {
        if (!mounted) return;
        setGroups([]);
        setGroupTotal(0);
      } finally {
        if (mounted) setGroupLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [viewTab, groupStatus, groupOffset, fetchGroups]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (viewTab !== 'groups') return;
      if (!selectedGroupId) {
        setGroupDetail(null);
        return;
      }
      try {
        const data = await fetchGroupDetail(selectedGroupId);
        if (!mounted) return;
        setGroupDetail(data || null);
      } catch {
        if (!mounted) return;
        setGroupDetail(null);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [viewTab, selectedGroupId, fetchGroupDetail]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!canProduction) return;
      if (viewTab !== 'groups') return;
      if (productsLoading) return;
      if (products.length > 0) return;
      try {
        setProductsLoading(true);
        const res = await api.get('/products/');
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (!mounted) return;
        setProducts(list);
      } catch {
        if (!mounted) return;
        setProducts([]);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [api, canProduction, viewTab, products.length, productsLoading]);

  const handleScan = async (rawOverride) => {
    clearScanIdleTimer();
    const raw = String(rawOverride ?? scanValue ?? '').trim();
    if (!raw) return;
    setScanValue('');
    scanLastInputAtRef.current = 0;
    scanBurstStartAtRef.current = 0;
    scanPrevLenRef.current = 0;
    scanAutoModeRef.current = false;
    setTopError('');
    setTopHint('');

    try {
      if (step === 'epc') {
        const epcCode = raw;
        if (scannedRef.current.has(epcCode)) {
          const ok = window.confirm(t('scanDuplicateConfirm', { epc: epcCode }));
          if (!ok) return;
          const existing = rows.find((r) => String(r.epcCode) === String(epcCode));
          if (existing) selectRow(existing);
          return;
        }

        const item = await lookupEpc(epcCode);
        if (!item) throw new Error(t('scanEpcNotFound'));
        scannedRef.current.add(epcCode);
        upsertRow(item, { rowError: '' });
        selectRow(item);

        const nxt = nextMissingStep(item);
        if (nxt === 'epc') {
          setTopHint(t('scanEpcComplete'));
        } else if (nxt === 'netWeight') {
          setTopHint(t('scanPromptNetWeight'));
        } else {
          setTopHint(t('scanPromptCaiq'));
        }
        return;
      }

      if (!current?.id) {
        setStep('epc');
        setTopError(t('scanNoActiveEpc'));
        return;
      }

      if (step === 'netWeight') {
        if (looksLikeEpcCode(raw)) {
          setTopError(t('scanEpcScannedButExpected', { expected: t('netWeight') }));
          return;
        }
        const value = stripPrefix(raw, ['NW', 'NETWEIGHT', 'NET WEIGHT']);
        if (!value || !hasAnyDigit(value)) {
          setTopError(t('scanInvalidNetWeight'));
          return;
        }
        const normalized = formatNetWeightValue(value);
        upsertRow(current, { saving: true, rowError: '' });
        const updated = await patchItem(current.id, { netWeight: normalized });
        upsertRow(updated, { saving: false, rowError: '' });
        setCurrent(updated);
        const nxt = nextMissingStep(updated);
        setStep(nxt);
        setTopHint(nxt === 'caiqNumber' ? t('scanPromptCaiq') : t('scanPromptEpc'));
        return;
      }

      if (step === 'caiqNumber') {
        if (isSkipToken(raw)) {
          skipCaiq();
          return;
        }

        let maybeNextItem = null;
        try {
          maybeNextItem = await lookupEpc(raw);
        } catch {
          maybeNextItem = null;
        }

        if (maybeNextItem?.epcCode) {
          const epcCode = String(maybeNextItem.epcCode || '').trim();
          skipCaiq();

          if (scannedRef.current.has(epcCode)) {
            const ok = window.confirm(t('scanDuplicateConfirm', { epc: epcCode }));
            if (!ok) return;
            const existing = rows.find((r) => String(r.epcCode) === String(epcCode));
            if (existing) selectRow(existing);
            return;
          }

          setTopHint(t('scanAutoSkipCaiq'));

          scannedRef.current.add(epcCode);
          upsertRow(maybeNextItem, { rowError: '' });
          selectRow(maybeNextItem);

          const nxt = nextMissingStep(maybeNextItem);
          if (nxt === 'epc') {
            setTopHint(t('scanEpcComplete'));
          } else if (nxt === 'netWeight') {
            setTopHint(t('scanPromptNetWeight'));
          } else {
            setTopHint(t('scanPromptCaiq'));
          }
          return;
        }

        if (looksLikeEpcCode(raw)) {
          setTopError(t('scanEpcScannedButExpected', { expected: t('caiqNo') }));
          return;
        }
        const value = stripPrefix(raw, ['CAIQ', 'CAIQNO', 'CAIQ NO', 'CAIQNUMBER', 'CAIQ NUMBER']);
        if (!value) {
          setTopError(t('scanInvalidCaiq'));
          return;
        }
        upsertRow(current, { saving: true, rowError: '' });
        const updated = await patchItem(current.id, { caiqNumber: value });
        upsertRow(updated, { saving: false, rowError: '' });
        setCurrent(updated);
        const nxt = nextMissingStep(updated);
        setStep(nxt);
        setTopHint(t('scanPromptEpc'));
        return;
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('saveFailed');
      if (current?.id) upsertRow(current, { saving: false, rowError: msg });
      setTopError(msg);
    } finally {
      inputRef.current?.focus();
    }
  };

  handleScanRef.current = handleScan;

  useEffect(() => {
    clearScanIdleTimer();
    const now = Date.now();
    const raw = String(scanValue || '').trim();
    if (!raw) {
      scanLastInputAtRef.current = 0;
      scanBurstStartAtRef.current = 0;
      scanPrevLenRef.current = 0;
      scanAutoModeRef.current = false;
      return;
    }

    const prevLen = scanPrevLenRef.current;
    if (prevLen === 0 || raw.length < prevLen) {
      scanBurstStartAtRef.current = now;
      scanAutoModeRef.current = false;
    }
    const lastAt = scanLastInputAtRef.current;
    if (lastAt && now - lastAt < 50) scanAutoModeRef.current = true;
    if (scanBurstStartAtRef.current && now - scanBurstStartAtRef.current > 500) scanAutoModeRef.current = false;
    scanLastInputAtRef.current = now;
    scanPrevLenRef.current = raw.length;

    const minLen = step === 'epc' ? 6 : 1;
    if (raw.length < minLen) return;
    if (!scanAutoModeRef.current) return;
    scanIdleTimerRef.current = window.setTimeout(() => {
      scanIdleTimerRef.current = null;
      void handleScanRef.current?.(raw);
    }, 120);
    return () => {
      clearScanIdleTimer();
    };
  }, [scanValue, step]);

  const saveAmend = async ({ focusScanInput = true } = {}) => {
    if (!selectedRow?.id) return false;
    if (!canOverride) {
      setTopError(t('scanOverrideDenied'));
      return false;
    }
    setTopError('');
    setTopHint('');
    try {
      upsertRow(selectedRow, { saving: true, rowError: '' });
      const patch = {
        netWeight: editNetWeight ? formatNetWeightValue(editNetWeight) : null,
        caiqNumber: editCaiq ? String(editCaiq).trim() : null,
        productionDate: editProductionDate ? String(editProductionDate).trim() : null
      };
      if (patch.netWeight && looksLikeEpcCode(patch.netWeight)) {
        upsertRow(selectedRow, { saving: false, rowError: '' });
        setTopError(t('scanEpcScannedButExpected', { expected: t('netWeight') }));
        return false;
      }
      if (patch.caiqNumber && looksLikeEpcCode(patch.caiqNumber)) {
        upsertRow(selectedRow, { saving: false, rowError: '' });
        setTopError(t('scanEpcScannedButExpected', { expected: t('caiqNo') }));
        return false;
      }
      const updated = await patchItem(selectedRow.id, patch);
      upsertRow(updated, { saving: false, rowError: '' });
      selectRow(updated);
      setTopHint(t('saved'));
      return true;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('saveFailed');
      upsertRow(selectedRow, { saving: false, rowError: msg });
      setTopError(msg);
      return false;
    } finally {
      if (focusScanInput) inputRef.current?.focus();
    }
  };

  const stepLabel =
    step === 'epc' ? t('scanStepEpc') : step === 'netWeight' ? t('scanStepNetWeight') : step === 'caiqNumber' ? t('scanStepCaiq') : step;

  if (!canScanAccess) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">Insufficient permissions</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-zinc-900">{t('scanInputTitle')}</div>
          <div className="mt-1 text-sm text-zinc-600">{t('scanInputSubtitle')}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/epc" className="ac-btn ac-btn-soft px-3 py-2 text-xs no-underline hover:no-underline">
            {t('back')}
          </Link>
        </div>
      </div>

      {topError ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{topError}</div> : null}
      {topHint ? <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{topHint}</div> : null}

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  viewTab === 'batch' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                }`}
                onClick={() => setViewTab('batch')}
              >
                {t('scanTabBatch')}
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  viewTab === 'scanned' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                }`}
                onClick={() => setViewTab('scanned')}
              >
                {t('scanTabScanned')}
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  viewTab === 'groups' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                }`}
                onClick={() => setViewTab('groups')}
              >
                {t('scanTabGroups')}
              </button>
            </div>
            <div className="text-xs font-semibold text-zinc-600">
              {t('scanCurrentStep')}: <span className="text-zinc-900">{stepLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              {step === 'caiqNumber' && current?.id ? (
                <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={skipCaiq}>
                  {t('scanSkipCaiq')}
                </button>
              ) : null}
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={async () => {
                  const ok = window.confirm(t('scanResetScannedConfirm'));
                  if (!ok) return;
                  const ids = (Array.isArray(rows) ? rows : [])
                    .map((r) => Number(r?.id))
                    .filter((n) => Number.isFinite(n) && n > 0);

                  setTopError('');
                  setTopHint(t('saving'));
                  try {
                    if (ids.length) await api.post('/epc/items/production/reset', { itemIds: ids });
                    scannedRef.current = new Set();
                    setRows([]);
                    setCurrent(null);
                    setSelectedId(null);
                    setEditNetWeight('');
                    setEditCaiq('');
                    setStep('epc');
                    setTopError('');
                    setTopHint(t('scanResetScannedDone'));
                    inputRef.current?.focus();
                  } catch (e) {
                    const msg = e?.response?.data?.message || e?.message || t('saveFailed');
                    setTopError(msg);
                    setTopHint('');
                  }
                }}
              >
                {t('scanResetScanned')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                disabled={!rows.length}
                onClick={async () => {
                  const ok = window.confirm(t('scanConsolidateConfirm'));
                  if (!ok) return;
                  const ids = (Array.isArray(rows) ? rows : [])
                    .map((r) => Number(r?.id))
                    .filter((n) => Number.isFinite(n) && n > 0);
                  if (!ids.length) return;
                  setTopError('');
                  setTopHint(t('saving'));
                  try {
                    const res = await api.post('/epc/scan-groups', { itemIds: ids });
                    const data = res?.data?.data || null;
                    scannedRef.current = new Set();
                    setRows([]);
                    setCurrent(null);
                    setSelectedId(null);
                    setEditNetWeight('');
                    setEditCaiq('');
                    setStep('epc');
                    setTopError('');
                    setTopHint(t('scanGroupCreated', { id: data?.group?.id || '' }));
                    setViewTab('groups');
                    setGroupStatus('OPEN');
                    setGroupOffset(0);
                    setSelectedGroupId(data?.group?.id || null);
                    inputRef.current?.focus();
                  } catch (e) {
                    const msg = e?.response?.data?.message || e?.message || t('saveFailed');
                    setTopError(msg);
                    setTopHint('');
                  }
                }}
              >
                {t('scanConsolidate')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setTopError('');
                  setTopHint('');
                  setAmendOpen(true);
                }}
              >
                {t('scanAmend')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setCurrent(null);
                  setSelectedId(null);
                  setStep('epc');
                  setTopHint(t('scanPromptEpc'));
                  setTopError('');
                  inputRef.current?.focus();
                }}
              >
                {t('scanReset')}
              </button>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
            <input
              ref={inputRef}
              autoFocus
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  void handleScan();
                }
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  const el = document.activeElement;
                  if (!el) return;
                  const tag = String(el.tagName || '').toLowerCase();
                  const isEditable = el.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
                  if (!isEditable) inputRef.current?.focus();
                }, 0);
              }}
              onPaste={(e) => {
                const text = e.clipboardData?.getData('text') || '';
                if (!text) return;
                e.preventDefault();
                void handleScan(text);
              }}
              placeholder={step === 'netWeight' ? t('scanPromptNetWeight') : step === 'caiqNumber' ? t('scanPromptCaiq') : t('scanPromptEpc')}
              className="ac-input font-mono"
              autoComplete="off"
              inputMode="text"
            />
            <button type="button" className="ac-btn ac-btn-primary px-3 py-2 text-xs" onClick={() => void handleScan()}>
              {t('scanSubmit')}
            </button>
          </div>

          <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-[11px] font-semibold text-zinc-600">{t('scanActiveEpc')}</div>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <div className="text-[11px] text-zinc-500">{t('epcCode')}</div>
                <div className="truncate font-mono text-xs text-zinc-900">{current?.epcCode ? String(current.epcCode) : '-'}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">{t('batchName')}</div>
                <div className="truncate text-xs text-zinc-900">{current?.batch?.batchName ? String(current.batch.batchName) : '-'}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">{t('netWeight')}</div>
                <div className="truncate text-xs text-zinc-900">{current?.netWeight ? formatNetWeightValue(current.netWeight) : '-'}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">{t('caiqNo')}</div>
                <div className="truncate text-xs text-zinc-900">{current?.caiqNumber ? String(current.caiqNumber) : '-'}</div>
              </div>
            </div>
          </div>

          {viewTab === 'batch' ? (
            <div>
              <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_auto]">
                <select
                  value={selectedBatchId}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value);
                    setBatchOffset(0);
                  }}
                  className="ac-input"
                >
                  <option value="">{t('selectBatch')}</option>
                  {batches.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.batchName} ({b.corpPrefix})
                    </option>
                  ))}
                </select>
                <input
                  value={batchQuery}
                  onChange={(e) => {
                    setBatchQuery(e.target.value);
                    setBatchOffset(0);
                  }}
                  placeholder={t('searchEpc')}
                  className="ac-input"
                />
                <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => void fetchBatches()}>
                  {t('refresh')}
                </button>
              </div>

              <label className="mb-3 flex items-center gap-2 text-xs text-zinc-700">
                <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
                {t('scanPendingOnly')}
              </label>

              <div className="mb-2 text-[11px] text-zinc-500">
                {t('total', { value: Number(batchTotal) || 0 })}{' '}
                <span className="text-zinc-400">
                  • Page {Math.floor(batchOffset / batchLimit) + 1} / {Math.max(1, Math.ceil((Number(batchTotal) || 0) / batchLimit))}
                </span>
              </div>

              <DataTable
                minWidth={980}
                rows={batchItems}
                rowKey={(it) => it.id}
                loading={batchLoading}
                loadingContent={t('loading')}
                emptyContent={t('scanNoBatchItems')}
                columns={[
                  {
                    id: 'use',
                    header: '',
                    cell: (it) => (
                      <button type="button" className="ac-btn ac-btn-soft px-2 py-1 text-[11px]" onClick={() => selectRow(it)}>
                        {t('scanUse')}
                      </button>
                    )
                  },
                  { id: 'epcCode', header: t('epcCode'), cell: (it) => <span className="font-mono text-xs">{it.epcCode}</span> },
                  { id: 'netWeight', header: t('netWeight'), cell: (it) => <span className="text-sm">{it.netWeight ? formatNetWeightValue(it.netWeight) : '-'}</span> },
                  { id: 'caiqNumber', header: t('caiqNo'), cell: (it) => <span className="text-sm">{it.caiqNumber || '-'}</span> },
                  {
                    id: 'fillStatus',
                    header: t('status'),
                    cell: (it) =>
                      it.netWeight ? <span className="text-xs text-emerald-700">{t('scanComplete')}</span> : <span className="text-xs text-amber-700">{t('scanPending')}</span>
                  }
                ]}
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={batchOffset <= 0 || batchLoading}
                  onClick={() => setBatchOffset((v) => Math.max(0, v - batchLimit))}
                >
                  {t('prev')}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={batchLoading || batchOffset + batchLimit >= (Number(batchTotal) || 0)}
                  onClick={() => setBatchOffset((v) => v + batchLimit)}
                >
                  {t('next')}
                </button>
              </div>
            </div>
          ) : viewTab === 'groups' ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      groupStatus === 'OPEN' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                    }`}
                    onClick={() => {
                      setGroupStatus('OPEN');
                      setGroupOffset(0);
                      setSelectedGroupId(null);
                    }}
                  >
                    {t('scanGroupOpen')}
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      groupStatus === 'ASSIGNED' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                    }`}
                    onClick={() => {
                      setGroupStatus('ASSIGNED');
                      setGroupOffset(0);
                      setSelectedGroupId(null);
                    }}
                  >
                    {t('scanGroupAssigned')}
                  </button>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {t('total', { value: Number(groupTotal) || 0 })}{' '}
                  <span className="text-zinc-400">
                    • Page {Math.floor(groupOffset / groupLimit) + 1} / {Math.max(1, Math.ceil((Number(groupTotal) || 0) / groupLimit))}
                  </span>
                </div>
              </div>

              <DataTable
                minWidth={980}
                rows={groups}
                rowKey={(it) => it.id}
                loading={groupLoading}
                loadingContent={t('loading')}
                emptyContent={t('scanNoGroups')}
                columns={[
                  {
                    id: 'open',
                    header: '',
                    cell: (it) => (
                      <button type="button" className="ac-btn ac-btn-soft px-2 py-1 text-[11px]" onClick={() => setSelectedGroupId(it.id)}>
                        {t('open')}
                      </button>
                    )
                  },
                  { id: 'id', header: 'ID', cell: (it) => <span className="font-mono text-xs">#{it.id}</span> },
                  {
                    id: 'createdAt',
                    header: t('created'),
                    cell: (it) => <span className="text-sm">{it.createdAt ? new Date(it.createdAt).toLocaleString() : '-'}</span>
                  },
                  { id: 'status', header: t('status'), cell: (it) => <span className="text-sm">{String(it.status || '-')}</span> },
                  { id: 'items', header: t('qtyEpc'), cell: (it) => <span className="text-sm">{Number(it.totalItems) || 0}</span> },
                  {
                    id: 'product',
                    header: t('product'),
                    cell: (it) => <span className="text-sm">{it.product?.name ? `${it.product.name} (${it.product.sku})` : '-'}</span>
                  },
                  { id: 'actor', header: t('user'), cell: (it) => <span className="text-sm">{it.createdByEmail || '-'}</span> }
                ]}
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={groupOffset <= 0 || groupLoading}
                  onClick={() => setGroupOffset((v) => Math.max(0, v - groupLimit))}
                >
                  {t('prev')}
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                  disabled={groupLoading || groupOffset + groupLimit >= (Number(groupTotal) || 0)}
                  onClick={() => setGroupOffset((v) => v + groupLimit)}
                >
                  {t('next')}
                </button>
              </div>

              {groupDetail?.group?.id ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {t('scanGroup')}: <span className="font-mono">#{groupDetail.group.id}</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        {t('created')}: {groupDetail.group.createdAt ? new Date(groupDetail.group.createdAt).toLocaleString() : '-'} • {t('user')}:{' '}
                        {groupDetail.group.createdByEmail || '-'}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-zinc-600">
                      {t('status')}: <span className="text-zinc-900">{String(groupDetail.group.status || '-')}</span>
                    </div>
                  </div>

                  {canProduction && String(groupDetail.group.status || '').toUpperCase() === 'OPEN' ? (
                    <div className="mb-4 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
                      <select
                        value={assignProductId}
                        onChange={(e) => setAssignProductId(e.target.value)}
                        className="ac-input"
                        disabled={assignLoading || productsLoading}
                      >
                        <option value="">{t('selectProduct')}</option>
                        {productOptions.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                        disabled={assignLoading || !assignProductId}
                        onClick={async () => {
                          if (!assignProductId) return;
                          setTopError('');
                          setTopHint(t('saving'));
                          try {
                            setAssignLoading(true);
                            const res = await api.post(`/epc/scan-groups/${Number(groupDetail.group.id)}/assign-product`, {
                              productId: Number(assignProductId)
                            });
                            const data = res?.data?.data || null;
                            setGroupDetail(data || null);
                            setTopError('');
                            setTopHint(t('scanAssignDone'));
                            if (selectedGroupId) {
                              const refreshed = await fetchGroups({ status: groupStatus, limit: groupLimit, offset: groupOffset });
                              setGroups(Array.isArray(refreshed?.items) ? refreshed.items : []);
                              setGroupTotal(Number(refreshed?.total) || 0);
                            }
                          } catch (e) {
                            const msg = e?.response?.data?.message || e?.message || t('saveFailed');
                            setTopError(msg);
                            setTopHint('');
                          } finally {
                            setAssignLoading(false);
                          }
                        }}
                      >
                        {assignLoading ? t('saving') : t('scanAssignProduct')}
                      </button>
                    </div>
                  ) : null}

                  <DataTable
                    minWidth={980}
                    rows={Array.isArray(groupDetail.batches) ? groupDetail.batches : []}
                    rowKey={(it) => it.batchId}
                    emptyContent={t('scanNoGroupBatches')}
                    columns={[
                      { id: 'batchName', header: t('batchName'), cell: (it) => <span className="text-sm">{it.batchName || `#${it.batchId}`}</span> },
                      { id: 'corp', header: t('corpCode'), cell: (it) => <span className="text-sm">{it.corpPrefix || '-'}</span> },
                      { id: 'total', header: t('qtyEpc'), cell: (it) => <span className="text-sm">{Number(it.total) || 0}</span> },
                      {
                        id: 'missing',
                        header: t('scanMissingNetWeight'),
                        cell: (it) => <span className="text-sm">{Number(it.missingNetWeight) || 0}</span>
                      },
                      {
                        id: 'currentProduct',
                        header: t('product'),
                        cell: (it) => <span className="text-sm">{it.product?.name ? `${it.product.name} (${it.product.sku})` : '-'}</span>
                      }
                    ]}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <DataTable
              minWidth={980}
              rows={rows}
              rowKey={(it) => it.id}
              emptyContent={t('scanNoRows')}
              columns={[
                {
                  id: 'select',
                  header: '',
                  cell: (it) => (
                    <button type="button" className="ac-btn ac-btn-soft px-2 py-1 text-[11px]" onClick={() => selectRow(it)}>
                      {t('select')}
                    </button>
                  )
                },
                { id: 'epcCode', header: t('epcCode'), cell: (it) => <span className="font-mono text-xs">{it.epcCode}</span> },
                { id: 'batchName', header: t('batchName'), cell: (it) => <span className="text-sm">{it.batch?.batchName || '-'}</span> },
                { id: 'netWeight', header: t('netWeight'), cell: (it) => <span className="text-sm">{it.netWeight ? formatNetWeightValue(it.netWeight) : '-'}</span> },
                { id: 'caiqNumber', header: t('caiqNo'), cell: (it) => <span className="text-sm">{it.caiqNumber || '-'}</span> },
                {
                  id: 'productionDate',
                  header: t('productionDate'),
                  cell: (it) => (
                    <span className="text-sm">
                      {it.productionDate ? new Date(it.productionDate).toISOString().slice(0, 10) : '-'}
                    </span>
                  )
                },
                {
                  id: 'status',
                  header: t('status'),
                  cell: (it) => (
                    <div className="text-xs">
                      {it.saving ? <span className="text-amber-700">{t('saving')}</span> : <span className="text-emerald-700">{t('saved')}</span>}
                      {it.rowError ? <div className="mt-1 text-[11px] text-rose-700">{String(it.rowError)}</div> : null}
                    </div>
                  )
                }
              ]}
            />
          )}
        </div>
      </div>

      {amendOpen ? (
        <div
          className="ac-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setAmendOpen(false);
            inputRef.current?.focus();
          }}
        >
          <div className="ac-modal">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-zinc-900">{t('scanAmend')}</div>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={() => {
                  setAmendOpen(false);
                  inputRef.current?.focus();
                }}
              >
                {t('cancel')}
              </button>
            </div>

            {topError ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{topError}</div> : null}
            {topHint ? <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{topHint}</div> : null}

            {!selectedRow ? (
              <div className="text-xs text-zinc-600">{t('scanSelectRow')}</div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-[11px] text-zinc-500">{t('epcCode')}</div>
                  <div className="truncate font-mono text-xs text-zinc-900">{String(selectedRow.epcCode || '')}</div>
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('netWeight')}</div>
                  <input
                    ref={amendNetWeightRef}
                    value={editNetWeight}
                    onChange={(e) => setEditNetWeight(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      amendProductionDateRef.current?.focus();
                    }}
                    className="ac-input"
                    placeholder={t('netWeight')}
                    disabled={!canOverride}
                  />
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('productionDate')}</div>
                  <input
                    ref={amendProductionDateRef}
                    type="date"
                    value={editProductionDate}
                    onChange={(e) => setEditProductionDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      amendCaiqRef.current?.focus();
                    }}
                    className="ac-input"
                    disabled={!canOverride}
                  />
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('caiqNo')}</div>
                  <input
                    ref={amendCaiqRef}
                    value={editCaiq}
                    onChange={(e) => setEditCaiq(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const ok = await saveAmend({ focusScanInput: false });
                      if (ok) {
                        setAmendOpen(false);
                        inputRef.current?.focus();
                      }
                    }}
                    className="ac-input"
                    placeholder={t('caiqNo')}
                    disabled={!canOverride}
                  />
                </div>

                {!canOverride ? <div className="text-xs text-rose-700">{t('scanOverrideDenied')}</div> : null}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                    onClick={() => {
                      setAmendOpen(false);
                      inputRef.current?.focus();
                    }}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn-primary px-3 py-2 text-xs"
                    onClick={async () => {
                      const ok = await saveAmend({ focusScanInput: false });
                      if (ok) {
                        setAmendOpen(false);
                        inputRef.current?.focus();
                      }
                    }}
                    disabled={!canOverride}
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
