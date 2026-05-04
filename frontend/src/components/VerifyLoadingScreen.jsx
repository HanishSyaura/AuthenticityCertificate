import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/useT';

function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.2l1.9 1.9 4.4-4.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMeta(meta) {
  const label = meta?.label ? String(meta.label) : '';
  const value = meta?.value ? String(meta.value) : '';
  if (!label || !value) return null;
  const trimmed = value.length > 34 ? `${value.slice(0, 10)}…${value.slice(-10)}` : value;
  return `${label}: ${trimmed}`;
}

const VerifyLoadingScreen = ({ meta, mode = 'auto' }) => {
  const { t } = useT();
  const steps = useMemo(() => {
    const base = [t('verifyStepResolve'), t('verifyStepValidate'), t('verifyStepPrepare')].filter(Boolean);
    if (mode === 'resolve') return base;
    if (mode === 'verify') return base.slice(1);
    return base;
  }, [mode, t]);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!steps.length) return;
    const interval = setInterval(() => {
      setStepIndex((s) => (s + 1) % steps.length);
    }, 1050);
    return () => clearInterval(interval);
  }, [steps.length]);

  const metaText = formatMeta(meta);
  const progress = steps.length ? Math.round(((stepIndex + 1) / steps.length) * 100) : 0;
  const activeStep = steps[stepIndex] || t('verifying');

  return (
    <div className="ac-verify-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="ac-verify-blob ac-verify-blob--1" aria-hidden="true" />
      <div className="ac-verify-blob ac-verify-blob--2" aria-hidden="true" />
      <div className="ac-verify-blob ac-verify-blob--3" aria-hidden="true" />

      <div className="mx-auto w-full max-w-md px-5">
        <div className="ac-verify-card">
          <div className="ac-verify-card-inner">
            <div className="ac-verify-scan" aria-hidden="true" />
            <div className="ac-verify-icon">
              <IconShield className="h-8 w-8 text-zinc-900" />
            </div>
            <div className="mt-3 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t('verification')}</div>
              <div className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{t('verifying')}</div>
              <div className="mt-2 text-sm text-zinc-700">
                <span className="ac-verify-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="sr-only">{t('loading')}</span>
                <span>{activeStep}</span>
              </div>
              {metaText ? <div className="mt-3 font-mono text-[12px] text-zinc-600">{metaText}</div> : null}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500">
                <span>{t('verifyChecking')}</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="ac-verify-progress" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3 text-center text-[11px] text-zinc-500">{t('verifyKeepOpen')}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-zinc-500">© 2026 Product Authenticity Verification System</div>
      </div>
    </div>
  );
};

export default VerifyLoadingScreen;

