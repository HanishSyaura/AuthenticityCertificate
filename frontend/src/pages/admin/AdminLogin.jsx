import React, { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import useResolvedBranding from '../../hooks/useResolvedBranding';
import { resolvePublicMediaUrl } from '../../utils/apiBase';

function BrandMark({ logoUrl, code, title }) {
  if (logoUrl) {
    return (
      <img
        src={resolvePublicMediaUrl(logoUrl)}
        alt={title}
        className="block h-auto max-h-[132px] w-auto max-w-[220px] object-contain drop-shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
      />
    );
  }

  return (
    <div
      className="relative flex h-[128px] w-[128px] items-center justify-center overflow-hidden rounded-[28px] shadow-[0_16px_34px_rgba(15,23,42,0.14)]"
      style={{ background: 'linear-gradient(135deg, var(--ac-brand-deep) 0%, var(--ac-brand) 36%, var(--ac-brand-mid) 100%)' }}
    >
      <>
        <div className="absolute inset-0 bg-[linear-gradient(140deg,transparent_0%,transparent_28%,rgba(34,211,238,0.95)_28%,rgba(34,211,238,0.95)_43%,transparent_43%,transparent_56%,rgba(34,197,94,0.95)_56%,rgba(34,197,94,0.95)_72%,transparent_72%)] opacity-95" />
        <div className="relative z-10 text-center leading-none text-white">
          <div className="text-[44px] font-black tracking-[-0.06em]">{String(title || '').split(' ')[0] || 'Brand'}</div>
          <div className="mt-1 flex items-end justify-end gap-1 pr-1.5">
            <span className="text-[13px] font-extrabold tracking-tight">{String(code || 'PR').slice(0, 3)}</span>
            <span className="text-[22px] font-black tracking-[-0.04em]">{String(code || 'DMS').slice(0, 3)}</span>
          </div>
        </div>
      </>
    </div>
  );
}

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
  const branding = useResolvedBranding();
  const heroBadge = branding.loginHeroBadge || t('adminLoginHeroBadge');
  const heroTitle = branding.loginHeroTitle || t('adminLoginHeroTitle');
  const heroSubtitle = branding.loginHeroSubtitle || t('adminLoginHeroBody');
  const heroHighlights = branding.loginHeroHighlights?.length
    ? branding.loginHeroHighlights
    : [t('adminLoginPillLifecycle'), t('adminLoginPillTracking'), t('adminLoginPillLanding'), t('adminLoginPillTemplates')];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (token) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="ac-admin-login-shell min-h-screen">
      <div className="grid min-h-screen w-full xl:grid-cols-[1fr_1fr]">
        <section className="ac-admin-login-hero relative hidden min-h-screen overflow-hidden xl:block">
          <div className="relative z-10 flex min-h-screen flex-col justify-between px-7 py-6 text-white">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                <img
                  src={resolvePublicMediaUrl(branding.logoUrl)}
                  alt={branding.organizationName}
                  className="block h-12 w-auto max-w-[72px] shrink-0 object-contain drop-shadow-[0_12px_24px_rgba(8,47,73,0.20)]"
                />
              ) : (
                <div
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl shadow-[0_10px_28px_rgba(8,47,73,0.24)] ring-1 ring-white/18"
                  style={{ background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-mid) 100%)' }}
                >
                  <span className="text-xs font-black tracking-[0.16em] text-white">{branding.organizationCode.slice(0, 2)}</span>
                </div>
              )}
              <div>
                <div className="text-[1.1rem] font-semibold tracking-tight sm:text-[1.35rem]">{branding.appTitle}</div>
              </div>
            </div>

            <div className="relative z-10 max-w-[620px] pb-16">
              <div className="text-[36px] font-bold leading-[1.08] tracking-tight text-white 2xl:text-[44px]">
                {heroBadge}
              </div>
              <div className="mt-3 text-[22px] font-bold leading-tight text-[#ffbc48] 2xl:text-[25px]">{heroTitle}</div>
              <p className="mt-5 max-w-[600px] text-[14px] leading-7 text-white/92">
                {heroSubtitle}
              </p>
              <div className="mt-5 flex max-w-[580px] flex-wrap gap-2">
                {heroHighlights.map((item) => (
                  <div key={item} className="rounded-full border border-white/85 bg-white/6 px-3 py-1.5 text-[12px] font-semibold text-white/95">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-white/70">© 2026 {branding.organizationName} - {branding.appTitle}</div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center bg-[#f5f6fa] px-6 py-12 sm:px-10 lg:px-14">
          <div className="absolute right-10 top-10 z-10">
            <LanguageSwitcher size="xs" />
          </div>

          <div className="w-full max-w-[300px]">
            <h2 className="text-[2.2rem] font-bold tracking-[-0.04em] leading-[1.05] text-[#0b1730] sm:text-[2.45rem]">{t('adminLoginWelcomeBack')}</h2>
            <p className="mt-2 text-[13px] text-[#707b8d]">Sign in to your account</p>

            <div className="mt-6 flex justify-center">
              <BrandMark logoUrl={branding.logoUrl} code={branding.organizationCode} title={branding.appTitle} />
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
              className="mt-8 space-y-4"
            >
              <div>
                <label className="block text-[12px] font-semibold text-[#5d687a]">
                  {t('email')}
                  <span className="ml-1 text-[#e56e6e]">*</span>
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ac-input mt-2 rounded-xl border-[#d7dfeb] bg-[#eef3fb] px-4 py-[9px] text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#53a6c5] focus:ring-[#c7e5f0]"
                  placeholder="hanishsyaura@gmail.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#5d687a]">
                  {t('password')}
                  <span className="ml-1 text-[#e56e6e]">*</span>
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ac-input mt-2 rounded-xl border-[#d7dfeb] bg-[#eef3fb] px-4 py-[9px] text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#53a6c5] focus:ring-[#c7e5f0]"
                  placeholder="••••••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </div>

              {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div> : null}

              <button
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(10,123,163,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)', boxShadow: '0 12px 24px rgba(var(--ac-brand-rgb), 0.2)' }}
                type="submit"
              >
                {loading ? t('signingIn') : t('signIn')}
              </button>
            </form>

            <div className="mt-10 text-center text-[12px] text-[#a0a8b5]">← Back to home</div>
          </div>
        </section>
      </div>
    </div>
  );
}
