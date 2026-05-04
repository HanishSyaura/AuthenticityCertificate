import React, { useEffect, useMemo, useState } from 'react';
import useFraudStore from '../../store/useFraudStore';
import { useT } from '../../i18n/useT';
import { stripHtmlToText } from '../../utils/richText';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default function AdminFraud() {
  const { t } = useT();
  const { items, loading, error, lastSyncAt, fetchFlags, resolveFlag, createFlag } = useFraudStore((s) => ({
    items: s.items,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchFlags: s.fetchFlags,
    resolveFlag: s.resolveFlag,
    createFlag: s.createFlag
  }));

  const [status, setStatus] = useState('open');
  const [certId, setCertId] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('medium');

  useEffect(() => {
    void fetchFlags({ status });
  }, [fetchFlags, status]);

  const counts = useMemo(() => {
    const by = { low: 0, medium: 0, high: 0 };
    for (const it of items) {
      const s = String(it.severity || '').toLowerCase();
      if (s === 'low' || s === 'medium' || s === 'high') by[s] += 1;
    }
    return by;
  }, [items]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('fraudDetection')}</h2>
          <div className="mt-1 text-sm text-zinc-600">{t('fraudSubtitle')}</div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchFlags({ status })}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          >
            <option value="open">{t('open')}</option>
            <option value="resolved">{t('resolved')}</option>
          </select>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-3 gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
            <div>{t('severityLow')}: {counts.low}</div>
            <div>{t('severityMedium')}: {counts.medium}</div>
            <div>{t('severityHigh')}: {counts.high}</div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[1fr_120px_1.2fr_160px_220px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
                <div>{t('certificateId')}</div>
                <div>{t('severity')}</div>
                <div>{t('reason')}</div>
                <div>{t('status')}</div>
                <div className="text-right">{t('actions')}</div>
              </div>

              {loading ? (
                <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-sm font-semibold text-zinc-900">{t('noFraudFlags')}</div>
                  <div className="mt-1 text-xs text-zinc-600">{t('noFraudFlagsHint')}</div>
                </div>
              ) : (
                items.map((f) => (
                  <div
                    key={f.id}
                    className="grid grid-cols-[1fr_120px_1.2fr_160px_220px] gap-4 border-b border-zinc-100 px-4 py-3 text-sm text-zinc-800 last:border-b-0"
                  >
                    <div className="min-w-0 truncate font-mono text-[11px] text-zinc-900">{f.certificateId}</div>
                    <div className="text-xs text-zinc-700">{String(f.severity || '').toUpperCase()}</div>
                    <div className="text-xs text-zinc-700">{String(stripHtmlToText(f.reason) || '').trim() ? stripHtmlToText(f.reason) : '-'}</div>
                    <div className="text-xs text-zinc-700">{String(f.status || '').toUpperCase()}</div>
                    <div className="flex justify-end gap-2">
                      {String(f.status) === 'open' ? (
                        <button
                          type="button"
                          className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                          onClick={async () => {
                            await resolveFlag({ id: f.id });
                            await fetchFlags({ status });
                          }}
                        >
                          {t('resolve')}
                        </button>
                      ) : null}
                      <a
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        href={`/verify/${encodeURIComponent(f.certificateId)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('viewPublic')}
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold text-zinc-600">{t('manualFlag')}</div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('certificateId')}</div>
              <input value={certId} onChange={(e) => setCertId(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('reason')}</div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="h-20 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('severity')}</div>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs">
                <option value="low">{t('severityLow')}</option>
                <option value="medium">{t('severityMedium')}</option>
                <option value="high">{t('severityHigh')}</option>
              </select>
            </div>
            <button
              type="button"
              className="ac-btn w-full px-3 py-2 text-xs"
              disabled={!certId.trim() || !reason.trim() || loading}
              onClick={async () => {
                await createFlag({ certificateId: certId.trim(), reason: String(reason || '').trim(), severity });
                setReason('');
                if (status !== 'open') setStatus('open');
                await fetchFlags({ status: 'open' });
              }}
            >
              {t('createFlag')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
