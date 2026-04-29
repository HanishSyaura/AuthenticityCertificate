import React, { useEffect, useMemo, useState } from 'react';
import useIdentitiesStore from '../../store/useIdentitiesStore';
import { useT } from '../../i18n/useT';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default function AdminIdentities() {
  const { t } = useT();
  const { items, total, limit, offset, loading, error, lastSyncAt, fetchIdentities, unassignIdentity } = useIdentitiesStore((s) => ({
    items: s.items,
    total: s.total,
    limit: s.limit,
    offset: s.offset,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchIdentities: s.fetchIdentities,
    unassignIdentity: s.unassignIdentity
  }));

  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const showing = useMemo(() => {
    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(total, offset + limit);
    return { from, to };
  }, [total, offset, limit]);

  useEffect(() => {
    void fetchIdentities({ active: true });
  }, [fetchIdentities]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('identities')}</h2>
          <div className="mt-1 text-sm text-zinc-600">{t('identitiesSubtitle')}</div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchIdentities({ q, active: activeOnly, offset: 0 })}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchIdentities')}
            className="w-72 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            {t('activeOnly')}
          </label>
          <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => void fetchIdentities({ q, active: activeOnly, offset: 0 })}>
            {t('apply')}
          </button>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1fr_1fr_1.2fr_160px_160px_200px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
              <div>NFC UID</div>
              <div>EPC</div>
              <div>{t('certificateId')}</div>
              <div>{t('assignedAt')}</div>
              <div>{t('unassignedAt')}</div>
              <div className="text-right">{t('actions')}</div>
            </div>

            {loading ? (
              <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm font-semibold text-zinc-900">{t('noIdentities')}</div>
                <div className="mt-1 text-xs text-zinc-600">{t('noIdentitiesHint')}</div>
              </div>
            ) : (
              items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[1fr_1fr_1.2fr_160px_160px_200px] gap-4 border-b border-zinc-100 px-4 py-3 text-sm text-zinc-800 last:border-b-0"
                >
                  <div className="truncate font-mono text-[11px] text-zinc-900">{it.nfcUid || '-'}</div>
                  <div className="truncate font-mono text-[11px] text-zinc-900">{it.epc || '-'}</div>
                  <div className="truncate font-mono text-[11px] text-zinc-900">{it.certificateId}</div>
                  <div className="text-[11px] text-zinc-600">{formatDate(it.assignedAt)}</div>
                  <div className="text-[11px] text-zinc-600">{formatDate(it.unassignedAt)}</div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                      disabled={Boolean(it.unassignedAt)}
                      onClick={async () => {
                        if (!window.confirm(t('confirmUnassign'))) return;
                        await unassignIdentity({ id: it.id });
                        await fetchIdentities({ q, active: activeOnly });
                      }}
                    >
                      {t('unassign')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">
          <div>{t('showingCount', { from: showing.from, to: showing.to, total })}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ac-btn ac-btn-soft px-3 py-2 text-xs"
              disabled={offset <= 0 || loading}
              onClick={() => void fetchIdentities({ q, active: activeOnly, offset: Math.max(0, offset - limit) })}
            >
              {t('prev')}
            </button>
            <button
              type="button"
              className="ac-btn ac-btn-soft px-3 py-2 text-xs"
              disabled={offset + limit >= total || loading}
              onClick={() => void fetchIdentities({ q, active: activeOnly, offset: offset + limit })}
            >
              {t('next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

