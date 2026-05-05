import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function AdminEpcScan() {
  const { t } = useT();
  const inputRef = useRef(null);
  const scannedRef = useRef(new Set());

  const { token, user } = useAdminAuthStore((s) => ({ token: s.token, user: s.user }));
  const role = user?.role || 'admin';
  const perms = user?.permissions || [];
  const canOverride = role === 'super_admin' || role === 'admin' || hasPermission(perms, 'epc.override') || hasPermission(perms, '*');

  const api = useMemo(() => createAdminApi({ token }), [token]);

  const [step, setStep] = useState('epc');
  const [scanValue, setScanValue] = useState('');
  const [current, setCurrent] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editNetWeight, setEditNetWeight] = useState('');
  const [editCaiq, setEditCaiq] = useState('');
  const [topError, setTopError] = useState('');
  const [topHint, setTopHint] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const upsertRow = (item, extra) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => String(r.id) === String(item.id));
      const nextRow = {
        ...item,
        saving: false,
        rowError: '',
        lastSavedAt: Date.now(),
        ...(idx >= 0 ? prev[idx] : {}),
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

  const patchItem = async (itemId, patch) => {
    const res = await api.patch(`/epc/items/${Number(itemId)}/production`, patch || {});
    return res?.data?.data || null;
  };

  const handleScan = async () => {
    const raw = String(scanValue || '').trim();
    if (!raw) return;
    setScanValue('');
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
        const value = stripPrefix(raw, ['NW', 'NETWEIGHT', 'NET WEIGHT']);
        if (!value || !hasAnyDigit(value)) {
          setTopError(t('scanInvalidNetWeight'));
          return;
        }
        upsertRow(current, { saving: true, rowError: '' });
        const updated = await patchItem(current.id, { netWeight: value });
        upsertRow(updated, { saving: false, rowError: '' });
        setCurrent(updated);
        const nxt = nextMissingStep(updated);
        setStep(nxt);
        setTopHint(nxt === 'caiqNumber' ? t('scanPromptCaiq') : t('scanPromptEpc'));
        return;
      }

      if (step === 'caiqNumber') {
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

  const selectedRow = rows.find((r) => String(r.id) === String(selectedId)) || null;

  const saveAmend = async () => {
    if (!selectedRow?.id) return;
    if (!canOverride) {
      setTopError(t('scanOverrideDenied'));
      return;
    }
    setTopError('');
    setTopHint('');
    try {
      upsertRow(selectedRow, { saving: true, rowError: '' });
      const patch = {
        netWeight: editNetWeight ? String(editNetWeight).trim() : null,
        caiqNumber: editCaiq ? String(editCaiq).trim() : null
      };
      const updated = await patchItem(selectedRow.id, patch);
      upsertRow(updated, { saving: false, rowError: '' });
      selectRow(updated);
      setTopHint(t('saved'));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('saveFailed');
      upsertRow(selectedRow, { saving: false, rowError: msg });
      setTopError(msg);
    } finally {
      inputRef.current?.focus();
    }
  };

  const stepLabel =
    step === 'epc' ? t('scanStepEpc') : step === 'netWeight' ? t('scanStepNetWeight') : step === 'caiqNumber' ? t('scanStepCaiq') : step;

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-zinc-600">
              {t('scanCurrentStep')}: <span className="text-zinc-900">{stepLabel}</span>
            </div>
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

          <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
            <input
              ref={inputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleScan();
              }}
              placeholder={t('scanPlaceholder')}
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
                <div className="truncate text-xs text-zinc-900">{current?.netWeight ? String(current.netWeight) : '-'}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500">{t('caiqNo')}</div>
                <div className="truncate text-xs text-zinc-900">{current?.caiqNumber ? String(current.caiqNumber) : '-'}</div>
              </div>
            </div>
          </div>

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
              { id: 'netWeight', header: t('netWeight'), cell: (it) => <span className="text-sm">{it.netWeight || '-'}</span> },
              { id: 'caiqNumber', header: t('caiqNo'), cell: (it) => <span className="text-sm">{it.caiqNumber || '-'}</span> },
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
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('scanAmend')}</div>
          {!selectedRow ? (
            <div className="text-xs text-zinc-500">{t('scanSelectRow')}</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-[11px] text-zinc-500">{t('epcCode')}</div>
                <div className="truncate font-mono text-xs text-zinc-900">{String(selectedRow.epcCode || '')}</div>
              </div>

              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('netWeight')}</div>
                <input
                  value={editNetWeight}
                  onChange={(e) => setEditNetWeight(e.target.value)}
                  className="ac-input"
                  placeholder={t('netWeight')}
                  disabled={!canOverride}
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('caiqNo')}</div>
                <input
                  value={editCaiq}
                  onChange={(e) => setEditCaiq(e.target.value)}
                  className="ac-input"
                  placeholder={t('caiqNo')}
                  disabled={!canOverride}
                />
              </div>

              {!canOverride ? <div className="text-xs text-rose-700">{t('scanOverrideDenied')}</div> : null}

              <button type="button" className="ac-btn ac-btn-primary w-full px-3 py-2 text-xs" onClick={() => void saveAmend()} disabled={!canOverride}>
                {t('save')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

