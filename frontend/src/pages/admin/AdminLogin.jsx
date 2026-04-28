import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
    navigate(from, { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="ac-card w-full max-w-md p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-zinc-900">{t('adminLoginTitle')}</h1>
                <p className="mt-1 text-sm text-zinc-600">{t('adminLoginSubtitle')}</p>
              </div>
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
  );
}
