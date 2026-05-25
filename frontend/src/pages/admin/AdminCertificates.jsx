import React, { useEffect, useState } from 'react';
import useCertificatesStore from '../../store/useCertificatesStore';
import { useT } from '../../i18n/useT';
import DataTable from '../../components/ui/DataTable';
import TablePager from '../../components/ui/TablePager';
import RowActionsMenu from '../../components/ui/RowActionsMenu';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function Tag({ children }) {
  return <span className="ac-badge ac-badge-neutral">{children}</span>;
}

export default function AdminCertificates() {
  const { t } = useT();
  const {
    items,
    total,
    limit,
    offset,
    loading,
    error,
    lastSyncAt,
    fetchCertificates,
    assignIdentity,
    revokeCertificate,
    reissueCertificate
  } = useCertificatesStore((s) => ({
    items: s.items,
    total: s.total,
    limit: s.limit,
    offset: s.offset,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchCertificates: s.fetchCertificates,
    assignIdentity: s.assignIdentity,
    revokeCertificate: s.revokeCertificate,
    reissueCertificate: s.reissueCertificate
  }));

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCertId, setAssignCertId] = useState('');
  const [assignNfc, setAssignNfc] = useState('');
  const [assignEpc, setAssignEpc] = useState('');
  const [assignExp, setAssignExp] = useState('');

  useEffect(() => {
    void fetchCertificates({});
  }, [fetchCertificates]);

  return (
    <div className="ac-page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('certificates')}</h2>
          <div className="mt-1 text-sm text-zinc-600">{t('certificatesSubtitle')}</div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchCertificates({ q, status, type, offset: 0 })}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchCertificates')}
            className="ac-input w-64 px-3 py-2"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ac-input w-[180px] px-3 py-2"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="PENDING">PENDING</option>
            <option value="VALID">VALID</option>
            <option value="SUSPICIOUS">SUSPICIOUS</option>
            <option value="REVOKED">REVOKED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="ac-input w-[140px] px-3 py-2"
          >
            <option value="">{t('allTypes')}</option>
            <option value="batch">batch</option>
            <option value="unit">unit</option>
          </select>
          <button type="button" className="ac-btn px-3 py-2 text-xs" onClick={() => void fetchCertificates({ q, status, type, offset: 0 })}>
            {t('apply')}
          </button>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <DataTable
        minWidth={980}
        rows={items}
        rowKey={(c) => c.certificateId}
        loading={loading}
        loadingContent={t('loading')}
        emptyContent={
          <div>
            <div className="text-sm font-semibold text-zinc-900">{t('noCertificates')}</div>
            <div className="mt-1 text-xs text-zinc-600">{t('noCertificatesHint')}</div>
          </div>
        }
        bottom={
          <TablePager
            offset={offset}
            limit={limit}
            total={total}
            loading={loading}
            onOffsetChange={(next) => void fetchCertificates({ q, status, type, offset: next })}
            onLimitChange={(next) => void fetchCertificates({ q, status, type, limit: next, offset: 0 })}
          />
        }
        columns={[
          {
            id: 'certificateId',
            header: t('certificateId'),
            cell: (c) => (
              <div className="min-w-0">
                <div className="truncate font-mono text-[11px] text-zinc-900">{c.certificateId}</div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                  {c.issuedAt ? (
                    <span>
                      {t('issued')}: {formatDate(c.issuedAt)}
                    </span>
                  ) : null}
                  {c.expiresAt ? (
                    <span>
                      {t('expires')}: {formatDate(c.expiresAt)}
                    </span>
                  ) : null}
                </div>
                {Array.isArray(c.identities) && c.identities.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {c.identities.slice(0, 2).map((it) => (
                      <Tag key={it.id}>{it.nfcUid || it.epc}</Tag>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          },
          { id: 'type', header: t('type'), cell: (c) => <span className="text-xs text-zinc-700">{c.type}</span> },
          { id: 'status', header: t('status'), cell: (c) => <span className="text-xs text-zinc-700">{c.status}</span> },
          {
            id: 'product',
            header: t('product'),
            cell: (c) => <span className="text-xs text-zinc-700">{c.batch?.product?.name ? `${c.batch.product.name} (${c.batch.product.code})` : '-'}</span>
          },
          { id: 'batch', header: t('batch'), cell: (c) => <span className="text-xs text-zinc-700">{c.batch?.batchNo || '-'}</span> },
          {
            id: 'actions',
            header: t('actions'),
            align: 'right',
            cell: (c) => (
              <RowActionsMenu
                ariaLabel={t('actions')}
                items={[
                  {
                    key: 'assign',
                    label: t('assign'),
                    onSelect: () => {
                      setAssignCertId(c.certificateId);
                      setAssignNfc('');
                      setAssignEpc('');
                      setAssignExp('');
                      setAssignOpen(true);
                    }
                  },
                  {
                    key: 'revoke',
                    label: t('revoke'),
                    tone: 'danger',
                    onSelect: async () => {
                      if (!window.confirm(t('confirmRevoke'))) return;
                      await revokeCertificate({ certificateId: c.certificateId });
                      await fetchCertificates({ q, status, type });
                    }
                  },
                  {
                    key: 'reissue',
                    label: t('reissue'),
                    onSelect: async () => {
                      const reason = window.prompt(t('reissueReasonPrompt'));
                      if (reason == null) return;
                      await reissueCertificate({ certificateId: c.certificateId, reason });
                      await fetchCertificates({ q, status, type });
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

      {assignOpen ? (
        <div className="ac-modal-backdrop">
          <div className="ac-modal">
            <div className="mb-3 text-sm font-semibold text-zinc-900">{t('assignIdentity')}</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('certificateId')}</div>
                <input value={assignCertId} readOnly className="ac-input bg-zinc-50 px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">NFC UID</div>
                <input value={assignNfc} onChange={(e) => setAssignNfc(e.target.value)} className="ac-input px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">EPC</div>
                <input value={assignEpc} onChange={(e) => setAssignEpc(e.target.value)} className="ac-input px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('expiresAtOptional')}</div>
                <input value={assignExp} onChange={(e) => setAssignExp(e.target.value)} placeholder="2026-12-31" className="ac-input px-3 py-2 text-xs" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-xs" onClick={() => setAssignOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                onClick={async () => {
                  await assignIdentity({ certificateId: assignCertId, nfcUid: assignNfc, epc: assignEpc, expiresAt: assignExp });
                  setAssignOpen(false);
                  await fetchCertificates({ q, status, type });
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
