import React, { useEffect, useMemo, useState } from 'react';
import useIntegrationsStore from '../../store/useIntegrationsStore';
import { useT } from '../../i18n/useT';
import DataTable from '../../components/ui/DataTable';
import RowActionsMenu from '../../components/ui/RowActionsMenu';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const EVENT_OPTIONS = [
  { key: 'certificate_scanned', label: 'certificate_scanned' },
  { key: 'suspicious_detected', label: 'suspicious_detected' },
  { key: 'fraud_flag_created', label: 'fraud_flag_created' }
];

export default function AdminIntegrations() {
  const { t } = useT();
  const { apiKeys, webhooks, loading, error, lastSyncAt, fetchAll, createApiKey, revokeApiKey, createWebhook, setWebhookActive } =
    useIntegrationsStore((s) => ({
      apiKeys: s.apiKeys,
      webhooks: s.webhooks,
      loading: s.loading,
      error: s.error,
      lastSyncAt: s.lastSyncAt,
      fetchAll: s.fetchAll,
      createApiKey: s.createApiKey,
      revokeApiKey: s.revokeApiKey,
      createWebhook: s.createWebhook,
      setWebhookActive: s.setWebhookActive
    }));

  const [keyName, setKeyName] = useState('');
  const [rateLimit, setRateLimit] = useState('');
  const [lastCreatedKey, setLastCreatedKey] = useState(null);

  const [hookUrl, setHookUrl] = useState('');
  const [hookSecret, setHookSecret] = useState('');
  const [hookEvents, setHookEvents] = useState(() => new Set(['certificate_scanned']));

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const selectedEvents = useMemo(() => Array.from(hookEvents), [hookEvents]);

  return (
    <div className="ac-page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('integrations')}</h2>
          <div className="mt-1 text-sm text-zinc-600">{t('integrationsSubtitle')}</div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchAll()}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: formatDate(lastSyncAt) })}</span> : null}
          </div>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="ac-card overflow-hidden">
          <div className="ac-table-head">{t('apiKeys')}</div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_auto] md:items-end">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('name')}</div>
                <input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="ac-input px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('rateLimitPerMin')}</div>
                <input value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} className="ac-input px-3 py-2 text-xs" />
              </div>
              <button
                type="button"
                className="ac-btn px-3 py-2 text-xs"
                disabled={!keyName.trim() || loading}
                onClick={async () => {
                  const created = await createApiKey({ name: keyName.trim(), rateLimitPerMin: rateLimit });
                  setLastCreatedKey(created);
                  setKeyName('');
                  setRateLimit('');
                }}
              >
                {t('create')}
              </button>
            </div>

            {lastCreatedKey?.key ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <div className="font-semibold">{t('newApiKeyCreated')}</div>
                <div className="mt-1 font-mono text-[11px] break-all">{lastCreatedKey.key}</div>
                <button
                  type="button"
                  className="mt-2 underline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(String(lastCreatedKey.key));
                  }}
                >
                  {t('copyApiKey')}
                </button>
              </div>
            ) : null}
          </div>

          <div className="px-4 pb-4">
            <DataTable
              containerClassName="rounded-xl border border-zinc-200/80 shadow-none"
              minWidth={760}
              rows={apiKeys}
              rowKey={(k) => k.id}
              emptyContent={t('noApiKeys')}
              columns={[
                { id: 'name', header: t('name'), cell: (k) => <span className="text-xs text-zinc-800">{k.name}</span> },
                { id: 'key', header: t('apiKey'), cell: (k) => <span className="block max-w-[360px] truncate font-mono text-[11px] text-zinc-900">{k.key}</span> },
                { id: 'rate', header: t('rateLimitPerMin'), cell: (k) => <span className="text-xs text-zinc-700">{k.rateLimitPerMin}</span> },
                { id: 'created', header: t('created'), cell: (k) => <span className="text-[11px] text-zinc-500">{formatDate(k.createdAt)}</span> },
                {
                  id: 'actions',
                  header: t('actions'),
                  align: 'right',
                  cell: (k) => (
                    <RowActionsMenu
                      ariaLabel={t('actions')}
                      items={[
                        {
                          key: 'copy',
                          label: t('copy'),
                          onSelect: async () => {
                            await navigator.clipboard.writeText(String(k.key));
                          }
                        },
                        {
                          key: 'revoke',
                          label: k.revokedAt ? t('revoked') : t('revoke'),
                          disabled: Boolean(k.revokedAt),
                          tone: 'danger',
                          onSelect: async () => {
                            if (!window.confirm(t('confirmRevokeApiKey'))) return;
                            await revokeApiKey({ id: k.id });
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
        </div>

        <div className="ac-card overflow-hidden">
          <div className="ac-table-head">{t('webhooks')}</div>
          <div className="p-4">
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('webhookUrl')}</div>
                <input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} className="ac-input px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('webhookSecret')}</div>
                <input value={hookSecret} onChange={(e) => setHookSecret(e.target.value)} className="ac-input px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('events')}</div>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2 text-xs text-zinc-800 shadow-sm shadow-zinc-900/5">
                      <input
                        type="checkbox"
                        checked={hookEvents.has(opt.key)}
                        onChange={(e) => {
                          const next = new Set(hookEvents);
                          if (e.target.checked) next.add(opt.key);
                          else next.delete(opt.key);
                          setHookEvents(next);
                        }}
                      />
                      <span className="font-mono text-[11px]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="ac-btn w-full px-3 py-2 text-xs"
                disabled={!hookUrl.trim() || hookSecret.trim().length < 8 || selectedEvents.length === 0 || loading}
                onClick={async () => {
                  await createWebhook({ url: hookUrl.trim(), secret: hookSecret.trim(), events: selectedEvents });
                  setHookUrl('');
                  setHookSecret('');
                  setHookEvents(new Set(['certificate_scanned']));
                }}
              >
                {t('createWebhook')}
              </button>
            </div>
          </div>

          <div className="px-4 pb-4">
            <DataTable
              containerClassName="rounded-xl border border-zinc-200/80 shadow-none"
              minWidth={760}
              rows={webhooks}
              rowKey={(h) => h.id}
              emptyContent={t('noWebhooks')}
              columns={[
                { id: 'url', header: t('webhookUrl'), cell: (h) => <span className="block max-w-[420px] truncate text-xs text-zinc-800">{h.url}</span> },
                { id: 'events', header: t('events'), cell: (h) => <span className="block max-w-[260px] truncate font-mono text-[11px] text-zinc-700">{Array.isArray(h.events) ? h.events.join(',') : ''}</span> },
                { id: 'active', header: t('active'), cell: (h) => <span className="text-xs text-zinc-700">{h.isActive ? t('active') : t('inactive')}</span> },
                {
                  id: 'actions',
                  header: t('actions'),
                  align: 'right',
                  cell: (h) => (
                    <RowActionsMenu
                      ariaLabel={t('actions')}
                      items={[
                        {
                          key: 'toggle',
                          label: h.isActive ? t('disable') : t('enable'),
                          onSelect: async () => {
                            await setWebhookActive({ id: h.id, isActive: !h.isActive });
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
        </div>
      </div>
    </div>
  );
}
