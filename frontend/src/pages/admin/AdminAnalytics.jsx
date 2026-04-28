import React, { useEffect, useMemo } from 'react';
import useAnalyticsStore from '../../store/useAnalyticsStore';
import { useT } from '../../i18n/useT';

function StatCard({ title, value, hint }) {
  return (
    <div className="ac-card p-4">
      <div className="text-xs font-semibold text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-zinc-600">{hint}</div> : null}
    </div>
  );
}

function RiskPill({ score }) {
  const cls =
    score >= 70 ? 'bg-red-100 text-red-800' : score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  const label = score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label} • {score}</span>;
}

export default function AdminAnalytics() {
  const { t, locale } = useT();
  const { overview, scans, loading, error, selectedCertificate, certificateTimeline, fetchOverview, fetchScans, fetchCertificate, setOverrideStatus } =
    useAnalyticsStore((s) => ({
      overview: s.overview,
      scans: s.scans,
      loading: s.loading,
      error: s.error,
      selectedCertificate: s.selectedCertificate,
      certificateTimeline: s.certificateTimeline,
      fetchOverview: s.fetchOverview,
      fetchScans: s.fetchScans,
      fetchCertificate: s.fetchCertificate,
      setOverrideStatus: s.setOverrideStatus
    }));

  useEffect(() => {
    fetchOverview();
    fetchScans({ limit: 200, offset: 0 });
  }, [fetchOverview, fetchScans]);

  const rows = useMemo(() => scans?.items || [], [scans]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900">{t('analytics')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('analyticsSubtitle')}</p>
        {error ? <div className="mt-2 text-xs text-amber-700">{error}</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title={t('totalScans')} value={overview?.totalScans ?? '—'} />
        <StatCard title={t('scans24h')} value={overview?.last24h ?? '—'} />
        <StatCard title={t('uniqueCerts24h')} value={overview?.uniqueCertificates24h ?? '—'} />
        <StatCard title={t('suspicious24h')} value={overview?.suspicious24h ?? '—'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="ac-card overflow-hidden">
          <div className="px-5 pt-5">
            <div className="ac-card-title">{t('recentScans')}</div>
            <div className="ac-card-subtitle">{scans?.total ? `${scans.total} total` : ''}</div>
          </div>
          <div className="mt-4 overflow-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-zinc-50 text-left text-xs font-semibold text-zinc-600">
                <tr>
                  <th className="px-5 py-3">{t('time')}</th>
                  <th className="px-5 py-3">{t('certificateId')}</th>
                  <th className="px-5 py-3">{t('ip')}</th>
                  <th className="px-5 py-3">{t('risk')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-5 py-3 text-zinc-700">{new Date(r.timestamp).toLocaleString(locale)}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        className="font-mono text-[12px] font-semibold text-zinc-900 underline"
                        onClick={() => fetchCertificate(r.certificateId)}
                      >
                        {r.certificateId}
                      </button>
                    </td>
                    <td className="px-5 py-3 font-mono text-[12px] text-zinc-700">{r.ip}</td>
                    <td className="px-5 py-3">
                      <RiskPill score={r.riskScore ?? 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ac-card p-5">
          <div className="ac-card-title">{t('certificateId')}</div>
          <div className="ac-card-subtitle">{selectedCertificate || '—'}</div>

          {!certificateTimeline ? (
            <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
              Click a certificate ID to view scan history.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-semibold text-zinc-500">{t('overrideStatus')}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900">
                  {certificateTimeline.overrideStatus || '—'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft text-xs"
                    onClick={() => setOverrideStatus({ certificateId: selectedCertificate, status: 'SUSPICIOUS' })}
                    disabled={!selectedCertificate || loading}
                  >
                    {t('setSuspicious')}
                  </button>
                  <button
                    type="button"
                    className="ac-btn ac-btn-soft text-xs"
                    onClick={() => setOverrideStatus({ certificateId: selectedCertificate, status: null })}
                    disabled={!selectedCertificate || loading}
                  >
                    {t('clearOverride')}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-semibold text-zinc-500">{t('recentScans')}</div>
                <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
                  {(certificateTimeline.scans || []).slice(0, 50).map((s) => (
                    <div key={s.id} className="rounded-lg bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-zinc-800">{new Date(s.timestamp).toLocaleString(locale)}</div>
                        <RiskPill score={s.riskScore ?? 0} />
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-zinc-700">
                        <div><span className="font-semibold">{t('ip')}:</span> <span className="font-mono">{s.ip}</span></div>
                        <div><span className="font-semibold">{t('riskFlags')}:</span> {(s.riskFlags || []).join(', ') || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
