import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/useT';

function Step({ n, title, children, to, cta }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{n}</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{title}</div>
        </div>
        {to ? (
          <Link to={to} className="ac-btn ac-btn-soft px-3 py-2 text-xs">
            {cta}
          </Link>
        ) : null}
      </div>
      <div className="mt-2 text-sm text-zinc-700">{children}</div>
    </div>
  );
}

export default function AdminGuide() {
  const { t } = useT();
  const [expanded, setExpanded] = useState('flow');

  const sections = useMemo(
    () => [
      { key: 'flow', label: t('guideFlow') },
      { key: 'ops', label: t('guideOps') },
      { key: 'troubleshooting', label: t('guideTroubleshooting') }
    ],
    [t]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900">{t('gettingStarted')}</h2>
        <div className="mt-1 text-sm text-zinc-600">{t('gettingStartedSubtitle')}</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setExpanded(s.key)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              expanded === s.key ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {expanded === 'flow' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Step n="01" title={t('guideStepProductsTitle')} to="/admin/records" cta={t('openModule')}>
            {t('guideStepProductsBody')}
          </Step>
          <Step n="02" title={t('guideStepBatchesTitle')} to="/admin/records" cta={t('openModule')}>
            {t('guideStepBatchesBody')}
          </Step>
          <Step n="03" title={t('guideStepGenerateTitle')} to="/admin/records" cta={t('openModule')}>
            {t('guideStepGenerateBody')}
          </Step>
          <Step n="04" title={t('guideStepAssignTitle')} to="/admin/certificates" cta={t('openModule')}>
            {t('guideStepAssignBody')}
          </Step>
          <Step n="05" title={t('guideStepCmsTitle')} to="/admin/cms" cta={t('openModule')}>
            {t('guideStepCmsBody')}
          </Step>
          <Step n="06" title={t('guideStepTemplateTitle')} to="/admin/cert-templates" cta={t('openModule')}>
            {t('guideStepTemplateBody')}
          </Step>
          <Step n="07" title={t('guideStepPublishTitle')} to="/admin/cms" cta={t('openModule')}>
            {t('guideStepPublishBody')}
          </Step>
          <Step n="08" title={t('guideStepVerifyTitle')}>
            {t('guideStepVerifyBody')}
          </Step>
        </div>
      ) : null}

      {expanded === 'ops' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Step n="A" title={t('guideOpsMonitoringTitle')} to="/admin/analytics" cta={t('openModule')}>
            {t('guideOpsMonitoringBody')}
          </Step>
          <Step n="B" title={t('guideOpsFraudTitle')} to="/admin/fraud" cta={t('openModule')}>
            {t('guideOpsFraudBody')}
          </Step>
          <Step n="C" title={t('guideOpsBulkTitle')} to="/admin/bulk" cta={t('openModule')}>
            {t('guideOpsBulkBody')}
          </Step>
          <Step n="D" title={t('guideOpsMediaTitle')} to="/admin/media" cta={t('openModule')}>
            {t('guideOpsMediaBody')}
          </Step>
          <Step n="E" title={t('guideOpsGovernanceTitle')} to="/admin/audit" cta={t('openModule')}>
            {t('guideOpsGovernanceBody')}
          </Step>
          <Step n="F" title={t('guideOpsIntegrationsTitle')} to="/admin/integrations" cta={t('openModule')}>
            {t('guideOpsIntegrationsBody')}
          </Step>
        </div>
      ) : null}

      {expanded === 'troubleshooting' ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-semibold text-zinc-900">{t('guideTroubleshootingTitle')}</div>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-700">
            <li>{t('guideTs401')}</li>
            <li>{t('guideTsDbTimeout')}</li>
            <li>{t('guideTsUpload')}</li>
            <li>{t('guideTsVerify')}</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

