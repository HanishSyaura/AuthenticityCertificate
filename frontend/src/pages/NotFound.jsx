import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/useT';

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-semibold text-zinc-900">{t('pageNotFound')}</div>
          <div className="mt-1 text-sm text-zinc-600">{t('pageNotFoundHint')}</div>
          <div className="mt-4">
            <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
              {t('goToVerificationPage')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
