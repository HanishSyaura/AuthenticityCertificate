import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import PublicRenderer from '../components/PublicRenderer';
import VerifyLoadingScreen from '../components/VerifyLoadingScreen';
import { useT } from '../i18n/useT';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { buildUploadsWebpSrcSet } from '../utils/mediaVariants';
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

function VerifyPageBackground({ background, backgroundMode, reduceMotion }) {
  const url = resolvePublicMediaUrl(background);
  const mode = String(backgroundMode || '').trim() || 'background';
  const isVideo = /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
  const isLikelyImage = /\.(png|jpe?g|webp)(\?|#|$)/i.test(url);
  const webpSrcSet = !isVideo && isLikelyImage && url ? buildUploadsWebpSrcSet(url) : null;
  const bgClass =
    mode === 'actual'
      ? 'pointer-events-none fixed left-1/2 top-1/2 z-0 max-h-none max-w-none -translate-x-1/2 -translate-y-1/2 object-center'
      : mode === 'fit'
        ? 'pointer-events-none fixed inset-0 z-0 h-full w-full object-contain object-center'
        : 'pointer-events-none fixed inset-0 z-0 h-full w-full object-fill object-center';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [url, isVideo]);

  if (!url) return null;

  const opacityClass = reduceMotion
    ? 'opacity-100'
    : ready
      ? 'opacity-100 transition-opacity duration-300'
      : 'opacity-0 transition-opacity duration-300';

  if (isVideo) {
    return (
      <video
        key={url}
        src={url}
        muted
        playsInline
        autoPlay={!reduceMotion}
        loop
        preload={!reduceMotion ? 'metadata' : 'none'}
        className={`${bgClass} ${opacityClass}`}
        aria-hidden="true"
        tabIndex={-1}
        onLoadedData={() => setReady(true)}
      />
    );
  }

  const img = (
    <img
      key={url}
      src={url}
      alt=""
      className={`${bgClass} ${opacityClass}`}
      decoding="async"
      fetchPriority="low"
      draggable={false}
      onLoad={() => setReady(true)}
    />
  );

  if (webpSrcSet) {
    return (
      <picture className="fixed inset-0 z-0 h-full w-full">
        <source type="image/webp" srcSet={webpSrcSet} sizes="100vw" />
        {img}
      </picture>
    );
  }

  return img;
}

const VerifyPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { certificate, loading, error, verifyCertificate, resolveCertificate } = useAuthStore();
  const [certId, setCertId] = useState(id || '');
  const [loadingMeta, setLoadingMeta] = useState(null);
  const [loadingMode, setLoadingMode] = useState('auto');
  const [showLoader, setShowLoader] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const loaderStartAtRef = useRef(0);
  const loaderHideTimerRef = useRef(null);
  const { t, lang, locale } = useT();
  const hasTemplate = Boolean(Array.isArray(certificate?.certificateTemplate?.layoutJson));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduceMotion(!!mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

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

  const handleManualVerify = (e) => {
    e.preventDefault();
    const raw = String(certId || '').trim();
    if (!raw) return;
    const value = raw.toUpperCase();
    if (value !== certId) setCertId(value);

    const looksLikeCertId = /^(BN-[A-Z0-9]+|CERT\d{9,})$/.test(value);
    if (looksLikeCertId) {
      setLoadingMode('verify');
      setLoadingMeta({ label: t('certificateId'), value });
      verifyCertificate(value, { lang });
      return;
    }

    const looksLikeHex = /^[0-9A-F]+$/.test(value);
    if (looksLikeHex && value.length >= 8 && value.length <= 32) {
      setLoadingMode('resolve');
      setLoadingMeta({ label: t('nfcUid'), value });
      resolveCertificate({ epc: null, nfcUid: value }, { lang });
      return;
    }

    setLoadingMode('resolve');
    setLoadingMeta({ label: t('epc'), value });
    resolveCertificate({ epc: value, nfcUid: null }, { lang });
  };

  if (showLoader) {
    return (
      <div className="min-h-[100dvh]">
        <div className="fixed right-3 top-3 z-[60]">
          <LanguageSwitcher size="md" />
        </div>
        <VerifyLoadingScreen meta={loadingMeta} mode={loadingMode} />
      </div>
    );
  }

  if (certificate) {
    const batchDocs = Array.isArray(certificate?.batchDocuments) ? certificate.batchDocuments : [];
    const docOrder = ['moh_health_certificate', 'export_permit', 'dvs_health_certificate', 'dvs_coo_certificate'];
    const hasSupportingDocBlocks = Array.isArray(certificate?.layout)
      ? certificate.layout.some((b) => b && typeof b === 'object' && b.type === 'supporting_document')
      : false;
    if (Array.isArray(certificate?.layout)) {
      const pageBg = String(certificate?.certificateTemplate?.backgroundColor || '').trim() || '#ffffff';
      const pageBgMode = String(certificate?.certificateTemplate?.backgroundMode || '').trim() || 'background';
      const pageBgUrl = certificate?.certificateTemplate?.background ? String(certificate.certificateTemplate.background) : '';
      return (
        <div
          className="relative min-h-[100dvh] w-full overflow-x-hidden"
          style={{
            backgroundColor: pageBg,
            backgroundImage: undefined,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'top center',
            backgroundSize: undefined
          }}
        >
          <VerifyPageBackground background={pageBgUrl} backgroundMode={pageBgMode} reduceMotion={reduceMotion} />
          <div className="fixed right-3 top-3 z-50">
            <LanguageSwitcher size="md" />
          </div>
          <div className="relative z-10 w-full">
            <PublicRenderer layout={certificate.layout} data={certificate} responsive responsiveMode="viewport" baseWidth={390} />
          </div>
          {!hasSupportingDocBlocks && batchDocs.length ? (
            <div className="mx-auto w-full max-w-screen-md px-4 pb-10 pt-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-semibold text-zinc-900">{t('supportingCertificates')}</div>
                <div className="mt-3 space-y-2 text-sm">
                  {docOrder.map((docType) => {
                    const row = batchDocs.find((d) => String(d?.docType || '').trim() === docType);
                    const url = row?.mediaUrl ? String(row.mediaUrl).trim() : '';
                    const resolvedUrl = resolvePublicMediaUrl(url);
                    const label =
                      docType === 'moh_health_certificate'
                        ? t('mohHealthCertificate')
                        : docType === 'export_permit'
                          ? t('exportPermit')
                          : docType === 'dvs_health_certificate'
                            ? t('dvsHealthCertificate')
                            : t('dvsCooCertificate');
                    return resolvedUrl ? (
                      <a key={docType} href={resolvedUrl} target="_blank" rel="noreferrer" className="block underline">
                        {label}
                      </a>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    const statusUpper = String(certificate.status || '').toUpperCase();
    const statusOk = statusUpper === 'VALID';
    const statusPreview = statusUpper === 'PREVIEW';
    return (
      <div className="min-h-[100dvh]">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
          <div
            className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
              statusOk
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : statusPreview
                  ? 'border-zinc-200 bg-zinc-50 text-zinc-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusOk || statusPreview ? <IconShieldCheck className="h-5 w-5" /> : <IconShieldAlert className="h-5 w-5" />}
              <div className="text-sm font-semibold">{t('verification')}</div>
              <div className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold">{statusUpper || '-'}</div>
            </div>
            <LanguageSwitcher size="md" />
          </div>

          {hasTemplate ? (
            (() => {
              const canvasW = Number(certificate?.certificateTemplate?.canvasWidth || 390);
              const canvasH = Number(certificate?.certificateTemplate?.canvasHeight || 844);
              const baseW = Number.isFinite(canvasW) && canvasW > 0 ? canvasW : 390;
              const baseH = Number.isFinite(canvasH) && canvasH > 0 ? canvasH : 844;
              const pageBg = String(certificate?.certificateTemplate?.backgroundColor || '').trim() || '#ffffff';
              const pageBgMode = String(certificate?.certificateTemplate?.backgroundMode || '').trim() || 'background';
              const pageBgUrl = certificate?.certificateTemplate?.background ? String(certificate.certificateTemplate.background) : '';
              return (
                <div
                  className="relative min-h-[100dvh] overflow-x-hidden"
                  style={{
                    backgroundColor: pageBg,
                    backgroundImage: undefined,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'top center',
                    backgroundSize: undefined
                  }}
                >
                  <VerifyPageBackground background={pageBgUrl} backgroundMode={pageBgMode} reduceMotion={reduceMotion} />
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
                  {!hasSupportingDocBlocks && batchDocs.length ? (
                    <div className="mx-auto w-full max-w-screen-md px-4 pb-10 pt-6">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="text-sm font-semibold text-zinc-900">{t('supportingCertificates')}</div>
                        <div className="mt-3 space-y-2 text-sm">
                          {docOrder.map((docType) => {
                            const row = batchDocs.find((d) => String(d?.docType || '').trim() === docType);
                            const url = row?.mediaUrl ? String(row.mediaUrl).trim() : '';
                            const resolvedUrl = resolvePublicMediaUrl(url);
                            const label =
                              docType === 'moh_health_certificate'
                                ? t('mohHealthCertificate')
                                : docType === 'export_permit'
                                  ? t('exportPermit')
                                  : docType === 'dvs_health_certificate'
                                    ? t('dvsHealthCertificate')
                                    : t('dvsCooCertificate');
                            return resolvedUrl ? (
                              <a key={docType} href={resolvedUrl} target="_blank" rel="noreferrer" className="block underline">
                                {label}
                              </a>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()
          ) : (
            <div className="ac-card mx-auto max-w-2xl p-6 text-center">
              <h1 className="text-xl font-semibold text-zinc-900">{certificate.product?.name || t('product')}</h1>
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
                <div className="text-xs font-semibold text-zinc-500">{t('basicDetails')}</div>
                <div className="mt-2 font-mono text-base text-zinc-900">{certificate.certificateId}</div>
                <div className="mx-auto mt-4 inline-block rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-left text-xs text-zinc-800">
                  <div>
                    <span className="font-semibold">{t('batch')}:</span> {certificate.batch?.batchNo || '-'}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold">{t('date')}:</span> {certificate.issuedAt ? new Date(certificate.issuedAt).toLocaleString(locale) : '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <LanguageSwitcher size="md" />
        </div>
        <div className="ac-card p-6 text-center">
          <IconShieldCheck className="mx-auto mb-4 h-12 w-12 text-zinc-900" />
          <h1 className="text-lg font-semibold text-zinc-900">{t('productVerification')}</h1>
          <p className="mt-1 text-sm text-zinc-600">{t('verifySubtitle')}</p>

          <form onSubmit={handleManualVerify} className="mt-5 space-y-3">
            <input
              type="text"
              placeholder={t('verifyInputPlaceholder')}
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              className="ac-input text-center font-mono uppercase"
            />
            <button type="submit" disabled={!certId} className="ac-btn ac-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
              {t('verifyNow')}
            </button>
          </form>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <div className="flex items-center justify-center gap-2">
                <IconShieldAlert className="h-4 w-4" />
                <span>{error || t('verificationFailed')}</span>
              </div>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500 sm:text-base">{t('publicFooter')}</p>
      </div>
    </div>
  );
};

export default VerifyPage;
