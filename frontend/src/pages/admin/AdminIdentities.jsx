import React, { useEffect, useMemo, useState } from 'react';
import useIdentitiesStore from '../../store/useIdentitiesStore';
import { useT } from '../../i18n/useT';
import DataTable from '../../components/ui/DataTable';
import RowActionsMenu from '../../components/ui/RowActionsMenu';

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
    <div className="ac-page">
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
            className="ac-input w-72 px-3 py-2"
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

      <DataTable
        minWidth={980}
        rows={items}
        rowKey={(it) => it.id}
        loading={loading}
        loadingContent={t('loading')}
        emptyContent={
          <div>
            <div className="text-sm font-semibold text-zinc-900">{t('noIdentities')}</div>
            <div className="mt-1 text-xs text-zinc-600">{t('noIdentitiesHint')}</div>
          </div>
        }
        bottom={
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
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
        }
        columns={[
          { id: 'nfc', header: 'NFC UID', cell: (it) => <span className="block max-w-[220px] truncate font-mono text-[11px] text-zinc-900">{it.nfcUid || '-'}</span> },
          { id: 'epc', header: 'EPC', cell: (it) => <span className="block max-w-[220px] truncate font-mono text-[11px] text-zinc-900">{it.epc || '-'}</span> },
          { id: 'certificateId', header: t('certificateId'), cell: (it) => <span className="block max-w-[260px] truncate font-mono text-[11px] text-zinc-900">{it.certificateId}</span> },
          { id: 'assignedAt', header: t('assignedAt'), cell: (it) => <span className="text-[11px] text-zinc-600">{formatDate(it.assignedAt)}</span> },
          { id: 'unassignedAt', header: t('unassignedAt'), cell: (it) => <span className="text-[11px] text-zinc-600">{formatDate(it.unassignedAt)}</span> },
          {
            id: 'actions',
            header: t('actions'),
            align: 'right',
            cell: (it) => (
              <RowActionsMenu
                ariaLabel={t('actions')}
                items={[
                  {
                    key: 'unassign',
                    label: t('unassign'),
                    disabled: Boolean(it.unassignedAt),
                    onSelect: async () => {
                      if (!window.confirm(t('confirmUnassign'))) return;
                      await unassignIdentity({ id: it.id });
                      await fetchIdentities({ q, active: activeOnly });
                    }
                  }
                ]}
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
