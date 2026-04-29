import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/useT';

function Step({ n, title, children, to, cta }) {
  return (
    <div className="ac-card p-4">
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
    <div className="ac-page">
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
              expanded === s.key
                ? 'border-brand-200 bg-brand-50 text-brand-800 shadow-sm shadow-zinc-900/5'
                : 'border-zinc-200/80 bg-white text-zinc-900 hover:bg-zinc-50'
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
          <Step n="02" title={t('certificateList')} to="/admin/certificates" cta={t('openModule')}>
            {t('guideStepTemplateBody')}
          </Step>
          <Step n="03" title={t('guideStepBatchesTitle')} to="/admin/epc" cta={t('openModule')}>
            {t('guideStepBatchesBody')}
          </Step>
          <Step n="04" title={t('guideStepCmsTitle')} to="/admin/cms" cta={t('openModule')}>
            {t('guideStepCmsBody')}
          </Step>
          <Step n="05" title={t('guideStepVerifyTitle')}>
            {t('guideStepVerifyBody')}
          </Step>
        </div>
      ) : null}

      {expanded === 'ops' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Step n="A" title={t('settings')} to="/admin/settings" cta={t('openModule')}>
            {t('systemSettingsHint')}
          </Step>
          <Step n="B" title={t('usersRoles')} to="/admin/users" cta={t('openModule')}>
            {t('usersSubtitle')}
          </Step>
        </div>
      ) : null}

      {expanded === 'troubleshooting' ? (
        <div className="ac-card p-4">
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
