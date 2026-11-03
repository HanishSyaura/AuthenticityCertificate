import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '../i18n/useT';

function formatMeta(meta) {
  const label = meta?.label ? String(meta.label) : '';
  const value = meta?.value ? String(meta.value) : '';
  if (!label || !value) return null;
  const trimmed = value.length > 34 ? `${value.slice(0, 10)}…${value.slice(-10)}` : value;
  return `${label}: ${trimmed}`;
}

const VerifyLoadingScreen = ({ meta, mode = 'auto', brandLogoUrl = '' }) => {
  const { t } = useT();

  console.log('[VerifyLoadingScreen Props Audit]', {
    meta,
    mode,
    brandLogoUrl,
    hasBrandLogoUrl: Boolean(brandLogoUrl),
  });

  const reduceMotion = useReducedMotion();
  const steps = useMemo(() => {
    const base = [t('verifyStepResolve'), t('verifyStepValidate'), t('verifyStepPrepare')].filter(Boolean);
    if (mode === 'resolve') return base;
    if (mode === 'verify') return base.slice(1);
    return base;
  }, [mode, t]);
  const [stepIndex, setStepIndex] = useState(0);
  const [effectiveBrandLogoUrl, setEffectiveBrandLogoUrl] = useState(brandLogoUrl);

  useEffect(() => {
    if (brandLogoUrl) setEffectiveBrandLogoUrl(brandLogoUrl);
  }, [brandLogoUrl]);





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
    <motion.div
      className="ac-verify-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={reduceMotion ? undefined : { opacity: 1 }}
      transition={reduceMotion ? undefined : { duration: 0.35, ease: 'easeOut' }}
    >
      <motion.div
        className="ac-verify-blob ac-verify-blob--1"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? undefined : { opacity: 1 }}
        transition={reduceMotion ? undefined : { duration: 0.6, ease: 'easeOut' }}
      />
      <motion.div
        className="ac-verify-blob ac-verify-blob--2"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? undefined : { opacity: 1 }}
        transition={reduceMotion ? undefined : { duration: 0.6, delay: 0.05, ease: 'easeOut' }}
      />
      <motion.div
        className="ac-verify-blob ac-verify-blob--3"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? undefined : { opacity: 1 }}
        transition={reduceMotion ? undefined : { duration: 0.6, delay: 0.1, ease: 'easeOut' }}
      />

      <div className="mx-auto w-full max-w-md px-5">
        <motion.div
          className="ac-verify-card"
          initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={reduceMotion ? undefined : { type: 'spring', stiffness: 150, damping: 18, mass: 0.9 }}
        >
          <div className="ac-verify-card-inner">
            <div className="ac-verify-scan" aria-hidden="true" />
            <motion.div
              className="ac-verify-icon"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={reduceMotion ? undefined : { duration: 0.35, delay: 0.08, ease: 'easeOut' }}
            >
              {effectiveBrandLogoUrl ? (
                <img
                  src={effectiveBrandLogoUrl}
                  onLoad={(event) => {
                    console.log('[Verify Logo Image Loaded]', {
                      src: event.currentTarget.src,
                      naturalWidth: event.currentTarget.naturalWidth,
                      naturalHeight: event.currentTarget.naturalHeight,
                    });
                  }}
                  onError={(event) => {
                    console.error('[Verify Logo Image Failed]', {
                      src: event.currentTarget.src,
                      currentSrc: event.currentTarget.currentSrc,
                    });
                  }}
                  alt=""
                  aria-hidden="true"
                  draggable="false"
                  className="ac-verify-brand-logo"
                />
              ) : null}
            </motion.div>
            <div className="mt-3 text-center">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:text-base">{t('verification')}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{t('verifying')}</div>
              <div className="mt-2 text-lg text-zinc-700 sm:text-xl">
                <span className="ac-verify-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="sr-only">{t('loading')}</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={activeStep}
                    initial={reduceMotion ? false : { opacity: 0, y: 6, filter: 'blur(2px)' }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6, filter: 'blur(2px)' }}
                    transition={reduceMotion ? undefined : { duration: 0.22, ease: 'easeOut' }}
                    className="inline-block"
                  >
                    {activeStep}
                  </motion.span>
                </AnimatePresence>
              </div>
              {metaText ? (
                <motion.div
                  className="mt-3 font-mono text-sm text-zinc-600 sm:text-base"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={reduceMotion ? undefined : { duration: 0.25, delay: 0.12, ease: 'easeOut' }}
                >
                  {metaText}
                </motion.div>
              ) : null}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-sm font-semibold text-zinc-500 sm:text-base">
                <span>{t('verifyChecking')}</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <motion.div
                  className="ac-verify-progress"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20, mass: 0.6 }}
                />
              </div>
              <div className="mt-3 text-center text-sm text-zinc-500 sm:text-base">{t('verifyKeepOpen')}</div>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 text-center text-sm text-zinc-500 sm:text-base">{t('publicFooter')}</div>
      </div>
    </motion.div>
  );
};

export default VerifyLoadingScreen;
