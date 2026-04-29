import React, { useEffect, useMemo, useState } from 'react';
import useIntegrationsStore from '../../store/useIntegrationsStore';
import { useT } from '../../i18n/useT';

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
    <div className="p-4 sm:p-6 lg:p-8">
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
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">{t('apiKeys')}</div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_140px_auto] md:items-end">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('name')}</div>
                <input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('rateLimitPerMin')}</div>
                <input value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs" />
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

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.2fr_1fr_120px_180px_200px] gap-4 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
                <div>{t('name')}</div>
                <div>{t('apiKey')}</div>
                <div>{t('rateLimitPerMin')}</div>
                <div>{t('created')}</div>
                <div className="text-right">{t('actions')}</div>
              </div>

              {apiKeys.length === 0 ? (
                <div className="p-4 text-xs text-zinc-600">{t('noApiKeys')}</div>
              ) : (
                apiKeys.map((k) => (
                  <div key={k.id} className="grid grid-cols-[1.2fr_1fr_120px_180px_200px] gap-4 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-800">
                    <div className="text-xs text-zinc-800">{k.name}</div>
                    <div className="truncate font-mono text-[11px] text-zinc-900">{k.key}</div>
                    <div className="text-xs text-zinc-700">{k.rateLimitPerMin}</div>
                    <div className="text-[11px] text-zinc-500">{formatDate(k.createdAt)}</div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        onClick={async () => {
                          await navigator.clipboard.writeText(String(k.key));
                        }}
                      >
                        {t('copy')}
                      </button>
                      <button
                        type="button"
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        disabled={Boolean(k.revokedAt)}
                        onClick={async () => {
                          if (!window.confirm(t('confirmRevokeApiKey'))) return;
                          await revokeApiKey({ id: k.id });
                        }}
                      >
                        {k.revokedAt ? t('revoked') : t('revoke')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">{t('webhooks')}</div>
          <div className="p-4">
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('webhookUrl')}</div>
                <input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('webhookSecret')}</div>
                <input value={hookSecret} onChange={(e) => setHookSecret(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('events')}</div>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800">
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

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.5fr_1fr_120px_220px] gap-4 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
                <div>{t('webhookUrl')}</div>
                <div>{t('events')}</div>
                <div>{t('active')}</div>
                <div className="text-right">{t('actions')}</div>
              </div>

              {webhooks.length === 0 ? (
                <div className="p-4 text-xs text-zinc-600">{t('noWebhooks')}</div>
              ) : (
                webhooks.map((h) => (
                  <div key={h.id} className="grid grid-cols-[1.5fr_1fr_120px_220px] gap-4 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-800">
                    <div className="truncate text-xs text-zinc-800">{h.url}</div>
                    <div className="truncate font-mono text-[11px] text-zinc-700">{Array.isArray(h.events) ? h.events.join(',') : ''}</div>
                    <div className="text-xs text-zinc-700">{h.isActive ? t('active') : t('inactive')}</div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                        onClick={async () => {
                          await setWebhookActive({ id: h.id, isActive: !h.isActive });
                        }}
                      >
                        {h.isActive ? t('disable') : t('enable')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

