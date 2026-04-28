import React, { useEffect, useMemo, useState } from 'react';
import useAuditStore from '../../store/useAuditStore';
import { useT } from '../../i18n/useT';

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeEntry(e) {
  const timestamp = e?.timestamp || e?.createdAt || e?.created_at || null;
  return { ...e, timestamp };
}

export default function AdminAudit() {
  const { t } = useT();
  const { audits, loading, error, lastSyncAt, fetchAudits } = useAuditStore((s) => ({
    audits: s.audits,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchAudits: s.fetchAudits
  }));

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(200);
  const [offset, setOffset] = useState(0);
  const [live, setLive] = useState(true);

  useEffect(() => {
    void fetchAudits({ limit, offset });
  }, [fetchAudits, limit, offset]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      void fetchAudits({ limit, offset: 0 });
      setOffset(0);
    }, 10_000);
    return () => clearInterval(id);
  }, [live, fetchAudits, limit]);

  const items = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    const raw = Array.isArray(audits?.items) ? audits.items : [];
    const normalized = raw.map(normalizeEntry);
    if (!q) return normalized;
    return normalized.filter((e) => {
      const parts = [e.action, e.actorEmail, e.targetType, e.targetId, e.ip]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());
      return parts.some((p) => p.includes(q));
    });
  }, [audits, query]);

  const total = audits?.total || 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('auditLog')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('auditSubtitle')}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}`}>
              {live ? t('live') : t('paused')}
            </span>
            <button type="button" className="underline" onClick={() => void fetchAudits({ limit, offset })}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setOffset(0);
            }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
          >
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
          <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setLive((v) => !v)}>
            {live ? t('pauseLive') : t('resumeLive')}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_140px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchAudit')}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        />
        <button
          type="button"
          className="ac-btn ac-btn-soft px-3 py-3 text-sm"
          onClick={() => {
            setQuery('');
            setOffset(0);
          }}
        >
          {t('clear')}
        </button>
        <button
          type="button"
          className="ac-btn px-3 py-3 text-sm"
          onClick={() => {
            setOffset(0);
            void fetchAudits({ limit, offset: 0 });
          }}
        >
          {t('apply')}
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[140px_160px_1fr_120px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
              <div>{t('time')}</div>
              <div>{t('action')}</div>
              <div>{t('target')}</div>
              <div>{t('ip')}</div>
            </div>
            {loading ? (
              <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm font-semibold text-zinc-900">{t('noAudit')}</div>
                <div className="mt-1 text-xs text-zinc-600">{t('noAuditHint')}</div>
              </div>
            ) : (
              items.map((e) => (
                <div
                  key={e.id}
                  className="grid grid-cols-[140px_160px_1fr_120px] gap-4 border-b border-zinc-100 px-4 py-3 text-xs text-zinc-800 last:border-b-0"
                >
                  <div className="text-[11px] text-zinc-600">{formatDate(e.timestamp)}</div>
                  <div className="font-mono text-[11px] text-zinc-900">{e.action}</div>
                  <div>
                    <div className="text-[11px] text-zinc-900">
                      {e.targetType ? `${e.targetType}` : '-'}
                      {e.targetId ? <span className="text-zinc-500"> • {String(e.targetId)}</span> : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">{e.actorEmail || '-'}</div>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-700">{e.ip || '-'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
        <div>
          {t('showingCount', {
            from: total === 0 ? 0 : offset + 1,
            to: Math.min(total, offset + limit),
            total
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ac-btn ac-btn-soft px-3 py-2 text-xs"
            disabled={offset === 0}
            onClick={() => {
              const next = Math.max(0, offset - limit);
              setOffset(next);
            }}
          >
            {t('prev')}
          </button>
          <button
            type="button"
            className="ac-btn ac-btn-soft px-3 py-2 text-xs"
            disabled={offset + limit >= total}
            onClick={() => {
              const next = offset + limit;
              setOffset(next);
            }}
          >
            {t('next')}
          </button>
        </div>
      </div>
    </div>
  );
}
