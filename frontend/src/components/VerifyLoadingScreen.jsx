import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useT } from '../i18n/useT';
import { getPublicApiBaseUrl, resolveApiAssetUrl } from '../utils/apiBase';

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

function IconNest(props) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <path
        d="M10 37c3.5-10 12.8-17 22-17s18.5 7 22 17"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M8 41c6-6 15-10 24-10s18 4 24 10"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.92"
      />
      <path
        d="M12 45c4.5-4.5 12-7.5 20-7.5S47.5 40.5 52 45"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M16 49c5.2-3 10.8-4.4 16-4.4S42.8 46 48 49"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="26" cy="44.5" r="2.7" fill="currentColor" opacity="0.5" />
      <circle cx="32" cy="43.2" r="3.1" fill="currentColor" opacity="0.65" />
      <circle cx="38.5" cy="44.6" r="2.6" fill="currentColor" opacity="0.5" />
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
  const reduceMotion = useReducedMotion();
  const fallbackLogoUrl = String(import.meta.env.VITE_VERIFY_LOGO_URL || '/brand-logo.png').trim();
  const [brandLogoUrl, setBrandLogoUrl] = useState(() => {
    try {
      const raw = localStorage.getItem('ac_public_brand_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      const ts = Number(parsed?.ts || 0);
      const cached = typeof parsed?.logoUrl === 'string' ? parsed.logoUrl.trim() : '';
      if (!cached) return fallbackLogoUrl;
      if (!Number.isFinite(ts) || Date.now() - ts > 24 * 60 * 60 * 1000) return fallbackLogoUrl;
      return cached;
    } catch {
      return fallbackLogoUrl;
    }
  });
  const [brandLogoOk, setBrandLogoOk] = useState(true);
  const steps = useMemo(() => {
    const base = [t('verifyStepResolve'), t('verifyStepValidate'), t('verifyStepPrepare')].filter(Boolean);
    if (mode === 'resolve') return base;
    if (mode === 'verify') return base.slice(1);
    return base;
  }, [mode, t]);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setBrandLogoOk(true);
  }, [brandLogoUrl]);

  useEffect(() => {
    if (!brandLogoUrl) return;
    if (brandLogoUrl === fallbackLogoUrl) return;
    try {
      localStorage.setItem('ac_public_brand_v1', JSON.stringify({ logoUrl: brandLogoUrl, ts: Date.now() }));
    } catch {
      void 0;
    }
  }, [brandLogoUrl, fallbackLogoUrl]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const base = getPublicApiBaseUrl();
        const res = await fetch(`${base}/settings`, { signal: controller.signal });
        clearTimeout(timeout);
        const json = await res.json();
        const nextRaw = json?.success ? String(json?.data?.settings?.logoUrl || '').trim() : '';
        const next = nextRaw ? resolveApiAssetUrl(nextRaw) : '';
        if (!alive) return;
        if (next) setBrandLogoUrl(next);
        try {
          localStorage.setItem('ac_public_brand_v1', JSON.stringify({ logoUrl: next || '', ts: Date.now() }));
        } catch {
          void 0;
        }
      } catch {
        void 0;
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, []);

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
              {brandLogoOk && brandLogoUrl ? (
                <motion.img
                  src={brandLogoUrl}
                  alt=""
                  aria-hidden="true"
                  draggable="false"
                  className="ac-verify-brand-logo"
                  onError={() => setBrandLogoOk(false)}
                  animate={reduceMotion ? undefined : { scale: [1, 1.02, 1] }}
                  transition={reduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <>
                  <motion.div
                    className="ac-verify-nest"
                    aria-hidden="true"
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            rotate: [0, 2.5, 0],
                            scale: [1, 1.02, 1]
                          }
                    }
                    transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <IconNest className="h-full w-full" />
                  </motion.div>
                  <motion.div
                    aria-hidden="true"
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            scale: [1, 1.05, 1],
                            rotate: [0, 1.2, 0]
                          }
                    }
                    transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <IconShield className="h-8 w-8" style={{ color: '#f9901d' }} />
                  </motion.div>
                </>
              )}
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
