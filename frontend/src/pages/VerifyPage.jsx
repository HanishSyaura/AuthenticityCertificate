import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import PublicRenderer from '../components/PublicRenderer';
import { useT } from '../i18n/useT';
import LanguageSwitcher from '../components/LanguageSwitcher';

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

function IconLoader(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 12a9 9 0 1 1-9-9" />
    </svg>
  );
}

const VerifyPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { certificate, loading, error, verifyCertificate, resolveCertificate } = useAuthStore();
  const [certId, setCertId] = useState(id || '');
  const { t, lang, locale } = useT();
  const hasTemplate = Boolean(Array.isArray(certificate?.certificateTemplate?.layoutJson));

  useEffect(() => {
    if (id) {
      verifyCertificate(id, { lang });
      setCertId(id);
      return;
    }
    const sp = new URLSearchParams(location.search || '');
    const epc = sp.get('epc');
    const nfcUid = sp.get('nfcUid');
    if (epc || nfcUid) {
      resolveCertificate({ epc: epc || null, nfcUid: nfcUid || null }, { lang });
    }
  }, [id, lang, location.search, resolveCertificate, verifyCertificate]);
  const handleManualVerify = (e) => {
    e.preventDefault();
    const raw = String(certId || '').trim();
    if (!raw) return;
    const value = raw.toUpperCase();
    if (value !== certId) setCertId(value);

    const looksLikeCertId = /^BN-[A-Z0-9]+$/.test(value);
    if (looksLikeCertId) {
      verifyCertificate(value, { lang });
      return;
    }

    const looksLikeHex = /^[0-9A-F]+$/.test(value);
    if (looksLikeHex && value.length >= 8 && value.length <= 32) {
      resolveCertificate({ epc: null, nfcUid: value }, { lang });
      return;
    }

    resolveCertificate({ epc: value, nfcUid: null }, { lang });
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
        <IconLoader className="mb-4 h-10 w-10 animate-spin text-zinc-700" />
        <p className="text-base font-semibold text-zinc-900">{t('verifying')}</p>
      </div>
    );
  }

  if (certificate) {
    if (Array.isArray(certificate?.layout)) {
      return (
        <div className="min-h-[100dvh] w-full overflow-x-hidden bg-white">
          <div className="fixed right-3 top-3 z-50">
            <LanguageSwitcher size="xs" />
          </div>
          <div className="w-full">
            <PublicRenderer layout={certificate.layout} data={certificate} responsive responsiveMode="viewport" baseWidth={390} />
          </div>
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
            <LanguageSwitcher size="xs" />
          </div>

          {hasTemplate ? (
            (() => {
              const canvasW = Number(certificate?.certificateTemplate?.canvasWidth || 390);
              const canvasH = Number(certificate?.certificateTemplate?.canvasHeight || 844);
              const baseW = Number.isFinite(canvasW) && canvasW > 0 ? canvasW : 390;
              const baseH = Number.isFinite(canvasH) && canvasH > 0 ? canvasH : 844;
              return (
                <div className="min-h-[100dvh] overflow-x-hidden bg-white">
                  <div className="w-full">
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
          <LanguageSwitcher size="xs" />
        </div>
        <div className="ac-card p-6 text-center">
          <IconShieldCheck className="mx-auto mb-4 h-12 w-12 text-zinc-900" />
          <h1 className="text-lg font-semibold text-zinc-900">{t('productVerification')}</h1>
          <p className="mt-1 text-sm text-zinc-600">{t('verifySubtitle')}</p>

          <form onSubmit={handleManualVerify} className="mt-5 space-y-3">
            <input
              type="text"
              placeholder="BN-XXXXXXXXXX / EPC"
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

        <p className="mt-6 text-center text-[11px] text-zinc-500">© 2026 Product Authenticity Verification System</p>
      </div>
    </div>
  );
};

export default VerifyPage;
