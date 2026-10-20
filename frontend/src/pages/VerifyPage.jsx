import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import PublicRenderer from '../components/PublicRenderer';
import VerifyLoadingScreen from '../components/VerifyLoadingScreen';
import { useT } from '../i18n/useT';
import LanguageSwitcher from '../components/LanguageSwitcher';
import useResolvedBranding from '../hooks/useResolvedBranding';
import { resolvePublicMediaUrl } from '../utils/apiBase';

function IconShieldCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconShieldAlert(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function IconSparkles(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
      <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
      <path d="m19 13 .9 2.1L22 16l-2.1.9L19 19l-.9-2.1L16 16l2.1-.9L19 13Z" />
    </svg>
  );
}

function IconRefresh(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function translateCertificateStatus(t, statusRaw) {
  const s = String(statusRaw || '').trim().toUpperCase();
  if (!s) return '-';
  if (s === 'VALID') return t('statusValid');
  if (s === 'REVOKED') return t('statusRevoked');
  if (s === 'SUSPICIOUS') return t('statusSuspicious');
  if (s === 'EXPIRED') return t('statusExpired');
  if (s === 'PREVIEW') return t('statusPreview');
  return statusRaw || '-';
}

function VerifyLanguageSwitcher() {
  return (
    <div className="fixed bottom-3 right-3 z-40 sm:bottom-4 sm:right-4">
      <div className="origin-bottom-right scale-90 opacity-95">
        <LanguageSwitcher size="xs" />
      </div>
    </div>
  );
}

function VerifyViewport({ children, className = '', style = undefined }) {
  return (
    <div
      className={`relative h-[100dvh] w-full overflow-y-auto overflow-x-hidden ${className}`.trim()}
      style={{
        WebkitOverflowScrolling: 'touch',
        ...style
      }}
    >
      {children}
    </div>
  );
}

function VerifyHeroPanel({ branding, eyebrow, title, body, chips = [], alert = false }) {
  return (
    <section className={`ac-public-full-hero relative flex min-h-[38vh] overflow-hidden px-6 py-8 text-white sm:px-10 sm:py-10 xl:min-h-[100dvh] xl:px-12 xl:py-12 ${alert ? 'ac-public-full-hero--alert' : ''}`}>
      <div className="relative z-10 flex w-full flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] backdrop-blur">
            {branding.logoUrl ? (
              <img src={resolvePublicMediaUrl(branding.logoUrl)} alt={branding.organizationName} className="h-4 w-4 rounded object-contain" />
            ) : (
              <IconSparkles className="h-4 w-4" />
            )}
            {eyebrow || branding.organizationName}
          </div>
          <h1 className="mt-8 max-w-[560px] text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl xl:text-[64px]">{title}</h1>
          <p className="mt-5 max-w-[620px] text-sm leading-7 text-white/82 sm:text-base">{body}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {chips.map((item) => (
            <div key={item} className="rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/82 backdrop-blur">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const VerifyPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { certificate, loading, error, errorDetails, verifyCertificate, resolveCertificate, clearVerificationState } = useAuthStore();
  const [certId, setCertId] = useState(id || '');
  const [loadingMeta, setLoadingMeta] = useState(null);
  const [loadingMode, setLoadingMode] = useState('auto');
  const [showLoader, setShowLoader] = useState(false);
  const loaderStartAtRef = useRef(0);
  const loaderHideTimerRef = useRef(null);
  const { t, lang, locale } = useT();
  const branding = useResolvedBranding();
  const hasTemplate = Boolean(Array.isArray(certificate?.certificateTemplate?.layoutJson));

  const errorKind = (() => {
    const status = Number(errorDetails?.status || 0);
    const message = String(errorDetails?.message || error || '').toLowerCase();
    if (status === 404 || message.includes('not found') || message.includes('tidak dijumpai')) return 'not_found';
    if (status === 400 || message.includes('invalid') || message.includes('tidak sah')) return 'invalid';
    if (status === 503 || message.includes('unavailable') || message.includes('maintenance')) return 'service';
    return 'general';
  })();

  const searchedValue = String(loadingMeta?.value || certId || '').trim();
  const searchedLabel = String(loadingMeta?.label || t('verification')).trim();
  const checkedAt = new Date().toLocaleString(locale);
  const statusUpper = String(certificate?.status || '').toUpperCase();
  const statusOk = statusUpper === 'VALID';
  const statusPreview = statusUpper === 'PREVIEW';

  useEffect(() => {
    if (id) {
      setLoadingMode('verify');
      setLoadingMeta({ label: t('certificateId'), value: id });
      verifyCertificate(id, { lang });
      setCertId(id);
      return;
    }
    const sp = new URLSearchParams(location.search || '');
    const epc = sp.get('epc');
    const nfcUid = sp.get('nfcUid');
    if (epc || nfcUid) {
      setLoadingMode('resolve');
      if (epc) setLoadingMeta({ label: t('epc'), value: epc });
      else setLoadingMeta({ label: t('nfcUid'), value: nfcUid });
      resolveCertificate({ epc: epc || null, nfcUid: nfcUid || null }, { lang });
    }
  }, [id, lang, location.search, resolveCertificate, t, verifyCertificate]);

  useEffect(() => {
    const minDurationMs = 2000;
    const minHideDelayMs = 180;
    if (loaderHideTimerRef.current) {
      clearTimeout(loaderHideTimerRef.current);
      loaderHideTimerRef.current = null;
    }
    if (loading) {
      loaderStartAtRef.current = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      setShowLoader(true);
      return;
    }
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const elapsed = Math.max(0, now - (loaderStartAtRef.current || now));
    const remaining = Math.max(minHideDelayMs, minDurationMs - elapsed);
    loaderHideTimerRef.current = setTimeout(() => {
      loaderHideTimerRef.current = null;
      setShowLoader(false);
    }, remaining);
    return () => {
      if (loaderHideTimerRef.current) {
        clearTimeout(loaderHideTimerRef.current);
        loaderHideTimerRef.current = null;
      }
    };
  }, [loading]);

  const runCurrentLookup = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return;
    const nextValue = raw.toUpperCase();
    if (nextValue !== certId) setCertId(nextValue);

    const looksLikeCertId = /^(BN-[A-Z0-9]+|CERT\d{9,})$/.test(nextValue);
    if (looksLikeCertId) {
      setLoadingMode('verify');
      setLoadingMeta({ label: t('certificateId'), value: nextValue });
      verifyCertificate(nextValue, { lang });
      return;
    }

    const looksLikeHex = /^[0-9A-F]+$/.test(nextValue);
    if (looksLikeHex && nextValue.length >= 8 && nextValue.length <= 32) {
      setLoadingMode('resolve');
      // Hex-like values can be either EPC or NFC UID. Resolve both to keep
      // manual input behavior consistent with direct ?epc=... deep links.
      setLoadingMeta({ label: t('epc'), value: nextValue });
      resolveCertificate({ epc: nextValue, nfcUid: nextValue }, { lang });
      return;
    }

    setLoadingMode('resolve');
    setLoadingMeta({ label: t('epc'), value: nextValue });
    resolveCertificate({ epc: nextValue, nfcUid: null }, { lang });
  };

  const handleManualVerify = (e) => {
    e.preventDefault();
    runCurrentLookup(certId);
  };

  if (showLoader) {
    return (
      <VerifyViewport>
        <VerifyLanguageSwitcher />
        <VerifyLoadingScreen meta={loadingMeta} mode={loadingMode} />
      </VerifyViewport>
    );
  }

  if (certificate) {
    if (Array.isArray(certificate?.layout)) {
      const pageBg = String(certificate?.certificateTemplate?.backgroundColor || '').trim() || '#ffffff';
      if (statusOk || statusPreview) {
        return (
          <VerifyViewport
            style={{
              backgroundColor: pageBg,
              backgroundImage: undefined,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'top center',
              backgroundSize: undefined
            }}
          >
            <VerifyLanguageSwitcher />
            <PublicRenderer layout={certificate.layout} data={certificate} responsive responsiveMode="viewport" baseWidth={390} />
          </VerifyViewport>
        );
      }

      return (
        <VerifyViewport className="ac-public-shell">
          <VerifyLanguageSwitcher />
          <div className="grid min-h-[100dvh] w-full xl:grid-cols-[0.96fr_1.04fr]">
            <VerifyHeroPanel
              branding={branding}
              eyebrow={branding.organizationName}
              title={translateCertificateStatus(t, statusUpper)}
              body={t('publicVerifyHint')}
              chips={[t('verification'), certificate.certificateId || '-', certificate.product?.name || t('product')]}
            />
            <section
              className="relative min-h-[62vh] px-4 py-6 sm:px-6 lg:px-8 xl:min-h-[100dvh] xl:px-10 xl:py-8"
              style={{
                backgroundColor: pageBg,
                backgroundImage: undefined,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'top center',
                backgroundSize: undefined
              }}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--ac-brand)' }}>{t('certificateTitle')}</div>
                  <div className="mt-1 text-sm text-zinc-600">
                    {certificate.product?.name || t('product')} • {translateCertificateStatus(t, statusUpper)}
                  </div>
                </div>
                <div className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm">
                  {certificate.certificateId || '-'}
                </div>
              </div>
              <div className="relative z-10 w-full">
                <PublicRenderer layout={certificate.layout} data={certificate} responsive responsiveMode="viewport" baseWidth={390} />
              </div>
            </section>
          </div>
        </VerifyViewport>
      );
    }

    return (
      <VerifyViewport className="ac-public-shell">
        <VerifyLanguageSwitcher />
        <div className="grid min-h-[100dvh] w-full xl:grid-cols-[0.98fr_1.02fr]">
          <VerifyHeroPanel
            branding={branding}
            eyebrow={statusOk || statusPreview ? t('verification') : t('verificationFailedBadge')}
            title={statusOk ? t('statusValid') : translateCertificateStatus(t, statusUpper)}
            body={statusOk ? t('publicVerifyHint') : t('verificationFailedBody_general')}
            chips={[
              certificate.product?.name || t('product'),
              certificate.certificateId || '-',
              translateCertificateStatus(t, statusUpper)
            ]}
            alert={!statusOk && !statusPreview}
          />

          <section className="relative flex min-h-[62vh] items-center px-5 py-8 sm:px-8 xl:min-h-[100dvh] xl:px-12 xl:py-12">
            <div className="w-full">
              <div className="mb-8 flex flex-wrap items-center gap-3">
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] ${
                    statusOk
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : statusPreview
                        ? 'border-zinc-200 bg-white text-zinc-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {statusOk || statusPreview ? <IconShieldCheck className="h-4 w-4" /> : <IconShieldAlert className="h-4 w-4" />}
                  {translateCertificateStatus(t, statusUpper)}
                </div>
                <div className="text-sm text-zinc-500">{certificate.certificateId || searchedValue || '-'}</div>
              </div>

              {hasTemplate ? (
            (() => {
              const canvasW = Number(certificate?.certificateTemplate?.canvasWidth || 390);
              const canvasH = Number(certificate?.certificateTemplate?.canvasHeight || 844);
              const baseW = Number.isFinite(canvasW) && canvasW > 0 ? canvasW : 390;
              const baseH = Number.isFinite(canvasH) && canvasH > 0 ? canvasH : 844;
              const pageBg = String(certificate?.certificateTemplate?.backgroundColor || '').trim() || '#ffffff';
              return (
                <div className="grid gap-6 xl:grid-cols-[0.42fr_0.58fr] xl:items-start">
                  <div className="space-y-4">
                    <div className="border-b border-[#dbe7ef] pb-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--ac-brand)' }}>{t('product')}</div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{certificate.product?.name || '-'}</div>
                      <div className="mt-3 text-sm leading-7 text-zinc-600">{t('publicVerifyHint')}</div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-[22px] border border-[#dbe7ef] bg-white/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('certificateId')}</div>
                        <div className="mt-2 break-all font-mono text-sm font-semibold text-zinc-900">{certificate.certificateId || '-'}</div>
                      </div>
                      <div className="rounded-[22px] border border-[#dbe7ef] bg-white/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('batch')}</div>
                        <div className="mt-2 text-sm font-semibold text-zinc-900">{certificate.batch?.batchNo || '-'}</div>
                      </div>
                      <div className="rounded-[22px] border border-[#dbe7ef] bg-white/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('date')}</div>
                        <div className="mt-2 text-sm font-semibold text-zinc-900">
                          {certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleString(locale) : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="relative overflow-hidden rounded-[32px] border border-white/75 bg-white/75 shadow-[0_28px_70px_rgba(15,23,42,0.08)] backdrop-blur"
                    style={{
                      backgroundColor: pageBg,
                      backgroundImage: undefined,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'top center',
                      backgroundSize: undefined
                    }}
                  >
                    <div className="relative z-10 w-full">
                      <PublicRenderer
                        responsive
                        responsiveMode="viewport"
                        baseWidth={baseW}
                        layout={[
                          {
                            id: '__certificate',
                            type: 'certificate',
                            x: 0,
                            y: 0,
                            w: baseW,
                            h: baseH,
                            content: { canvasWidth: baseW, canvasHeight: baseH }
                          }
                        ]}
                        data={certificate}
                      />
                    </div>
                  </div>
                </div>
              );
            })()
              ) : (
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--ac-brand)' }}>{t('product')}</div>
                    <h2 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-950">{certificate.product?.name || t('product')}</h2>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-600">{t('publicVerifyHint')}</p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-[#dbe7ef] bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('certificateId')}</div>
                        <div className="mt-2 break-all font-mono text-sm font-semibold text-zinc-900">{certificate.certificateId || '-'}</div>
                      </div>
                      <div className="rounded-[24px] border border-[#dbe7ef] bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('batch')}</div>
                        <div className="mt-2 text-sm font-semibold text-zinc-900">{certificate.batch?.batchNo || '-'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-[24px] border border-[#dbe7ef] bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('date')}</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">
                        {certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleString(locale) : '-'}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-[#dbe7ef] bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('verification')}</div>
                      <div className="mt-2 text-2xl font-semibold text-zinc-950">{translateCertificateStatus(t, statusUpper)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </VerifyViewport>
    );
  }

  if (error) {
    return (
      <VerifyViewport className="ac-public-shell">
        <VerifyLanguageSwitcher />
        <div className="grid min-h-[100dvh] w-full xl:grid-cols-[0.98fr_1.02fr]">
          <VerifyHeroPanel
            branding={branding}
            eyebrow={t('verificationFailedBadge')}
            title={t('verificationFailedTitle')}
            body={t(`verificationFailedBody_${errorKind}`)}
            chips={[searchedLabel, searchedValue || '-', t('whatYouCanDoNext')]}
            alert
          />

          <section className="relative flex min-h-[62vh] items-center px-5 py-8 sm:px-8 xl:min-h-[100dvh] xl:px-12 xl:py-12">
            <div className="w-full max-w-[720px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
                <IconShieldAlert className="h-4 w-4" />
                {t('verificationFailed')}
              </div>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-950">{t('verifyAnotherCode')}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">{t('verificationRetryHint')}</p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-[#ecd8dc] bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{searchedLabel}</div>
                  <div className="mt-2 break-all font-mono text-sm font-semibold text-slate-900">{searchedValue || '-'}</div>
                </div>
                <div className="rounded-[24px] border border-[#ecd8dc] bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{t('checkedAt')}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{checkedAt}</div>
                </div>
              </div>

              <form onSubmit={handleManualVerify} className="mt-8 space-y-4">
                <input
                  type="text"
                  placeholder={t('verifyInputPlaceholder')}
                  value={certId}
                  onChange={(e) => {
                    setCertId(e.target.value);
                    if (error) clearVerificationState();
                  }}
                  className="ac-input border-[#d7dfeb] bg-[#f7f9fc] text-center font-mono uppercase text-zinc-900 placeholder:text-zinc-400 focus:border-[#53a6c5] focus:ring-[#c7e5f0]"
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <button
                    type="submit"
                    disabled={!certId}
                    className="inline-flex w-full items-center justify-center rounded-[18px] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)', boxShadow: '0 16px 30px rgba(var(--ac-brand-rgb), 0.25)' }}
                  >
                    {t('verifyNow')}
                  </button>
                  <button
                    type="button"
                    disabled={!searchedValue}
                    onClick={() => runCurrentLookup(searchedValue)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-[#d7dfeb] bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.05)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <IconRefresh className="h-4 w-4" />
                    {t('tryAgain')}
                  </button>
                </div>
              </form>

              <div className="mt-8 grid gap-3">
                <div className="rounded-[24px] border border-[#ecd8dc] bg-[#fff7f8] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{t('systemMessage')}</div>
                  <div className="mt-2 text-sm leading-6 text-zinc-700">{error || t('verificationFailed')}</div>
                </div>
                <div className="rounded-[24px] border border-[#dbe7ef] bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  <div className="text-sm font-semibold text-slate-900">{t('whatYouCanDoNext')}</div>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    <div>{t('verifyNextStep_retry')}</div>
                    <div>{t('verifyNextStep_checkSource')}</div>
                    <div>{t('verifyNextStep_contact')}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </VerifyViewport>
    );
  }

  return (
    <VerifyViewport className="ac-public-shell">
      <VerifyLanguageSwitcher />
      <section className="relative flex min-h-[100dvh] items-center justify-center px-5 py-8 sm:px-8 xl:px-12 xl:py-12">
        <div className="w-full max-w-[720px]">
          <div className="mb-4 flex flex-col items-start gap-3">
            {branding.logoUrl ? (
              <img
                src={resolvePublicMediaUrl(branding.logoUrl)}
                alt={branding.appTitle}
                className="block h-auto max-h-14 w-auto max-w-[120px] object-contain"
              />
            ) : null}
            <div className="min-w-0 text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl">{branding.appTitle}</div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--ac-brand)' }}>{t('publicVerifyPage')}</div>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">{t('productVerification')}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">{t('publicVerifyHint')}</p>

          <form onSubmit={handleManualVerify} className="mt-8 space-y-4">
            <input
              type="text"
              placeholder={t('verifyInputPlaceholder')}
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              className="ac-input border-[#d7dfeb] bg-[#f7f9fc] text-center font-mono uppercase text-zinc-900 placeholder:text-zinc-400 focus:border-[#53a6c5] focus:ring-[#c7e5f0]"
            />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="submit"
                disabled={!certId}
                className="inline-flex w-full items-center justify-center rounded-[18px] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)', boxShadow: '0 16px 30px rgba(var(--ac-brand-rgb), 0.25)' }}
              >
                {t('verifyNow')}
              </button>
            </div>
          </form>
        </div>
      </section>
    </VerifyViewport>
  );
};

export default VerifyPage;
