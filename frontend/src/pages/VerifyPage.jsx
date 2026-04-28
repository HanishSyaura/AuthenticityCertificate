import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  const { certificate, loading, error, verifyCertificate } = useAuthStore();
  const [certId, setCertId] = useState(id || '');
  const { t, lang, locale } = useT();

  useEffect(() => {
    if (id) {
      verifyCertificate(id, { lang });
      setCertId(id);
    }
  }, [id, lang, verifyCertificate]);
  const handleManualVerify = (e) => {
    e.preventDefault();
    if (certId) {
      verifyCertificate(certId, { lang });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <IconLoader className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-lg font-medium">{t('verifying')}</p>
      </div>
    );
  }

  if (certificate) {
    return (
      <div>
        {/* Verification Status Header */}
        <div className={`p-4 flex items-center justify-center space-x-2 ${
          certificate.status === 'VALID' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {certificate.status === 'VALID' ? <IconShieldCheck className="w-5 h-5" /> : <IconShieldAlert className="w-5 h-5" />}
          <span className="font-bold">{t('verification')}: {certificate.status}</span>
        </div>

        {/* Dynamic CMS Content */}
        {certificate.layout ? (
          <PublicRenderer layout={certificate.layout} data={certificate} />
        ) : (
          <div className="max-w-2xl mx-auto p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">{certificate.product.name}</h1>
            <div className="border-2 border-dashed border-gray-300 p-12 rounded-lg">
              <p className="text-gray-500 mb-2">{t('basicDetails')}</p>
              <p className="text-xl font-mono mb-4">{certificate.certificateId}</p>
              <div className="text-left bg-white p-4 rounded shadow-sm inline-block">
                 <p><strong>{t('batch')}:</strong> {certificate.batch.batchNo}</p>
                 <p><strong>{t('date')}:</strong> {new Date(certificate.issuedAt).toLocaleString(locale)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher size="xs" />
        </div>
        <IconShieldCheck className="w-16 h-16 text-primary mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('productVerification')}</h1>
        <p className="text-gray-600 mb-8">{t('verifySubtitle')}</p>

        <form onSubmit={handleManualVerify} className="space-y-4">
          <input
            type="text"
            placeholder="BN-XXXXXXXXXX"
            value={certId}
            onChange={(e) => setCertId(e.target.value)}
            className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none font-mono text-center text-lg uppercase"
          />
          <button
            type="submit"
            disabled={!certId}
            className="w-full bg-primary text-white p-4 rounded-lg font-bold hover:bg-slate-800 transition-colors disabled:bg-gray-300"
          >
            {t('verifyNow')}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center justify-center space-x-2">
            <IconShieldAlert className="w-5 h-5" />
            <span>{error || t('verificationFailed')}</span>
          </div>
        )}
      </div>
      
      <p className="mt-8 text-sm text-gray-400">© 2026 Product Authenticity Verification System</p>
    </div>
  );
};

export default VerifyPage;
