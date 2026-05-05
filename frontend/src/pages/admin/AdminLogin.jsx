import React, { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = useMemo(() => location.state?.from || '/admin/dashboard', [location.state]);
  const { t } = useT();
  const { login, loading, error, token } = useAdminAuthStore((s) => ({
    login: s.login,
    loading: s.loading,
    error: s.error,
    token: s.token
  }));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (token) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid min-h-[calc(100vh-5rem)] items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="ac-card relative overflow-hidden p-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50/70 via-white to-emerald-50/50" />
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm shadow-zinc-900/5 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {t('adminPanel')}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900">{t('adminLoginTitle')}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">{t('adminLoginSubtitle')}</p>

              <div className="mt-6 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm shadow-zinc-900/5 backdrop-blur">
                  <div className="text-xs font-semibold text-zinc-900">{t('cmsBuilder')}</div>
                  <div className="mt-1 text-xs text-zinc-600">{t('cmsSubheading')}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm shadow-zinc-900/5 backdrop-blur">
                  <div className="text-xs font-semibold text-zinc-900">{t('certTemplates')}</div>
                  <div className="mt-1 text-xs text-zinc-600">{t('certTplSubheading')}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ac-card w-full max-w-lg justify-self-center p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{t('signIn')}</div>
                <div className="mt-1 text-xs text-zinc-600">{t('adminLoginSubtitle')}</div>
              </div>
              <div className="shrink-0">
                <LanguageSwitcher size="xs" />
              </div>
            </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await login({ email, password });
                navigate(from, { replace: true });
              } catch (e) {
                void e;
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-700">{t('email')}</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ac-input mt-1"
                placeholder="admin@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">{t('password')}</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ac-input mt-1"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}

            <button
              disabled={loading}
              className="ac-btn ac-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>

          </div>
        </div>
      </div>
    </div>
  );
}
