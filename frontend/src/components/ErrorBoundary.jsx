import React from 'react';
import useI18nStore from '../store/useI18nStore';
import { STRINGS } from '../i18n/strings';
import { tRaw } from '../i18n/tRaw';

const isDev = import.meta.env.DEV;

function isDebugEnabled() {
  if (isDev) return true;
  try {
    const qs = typeof window !== 'undefined' ? window.location.search : '';
    if (qs && new URLSearchParams(qs).get('debug') === '1') return true;
  } catch {
    void 0;
  }
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('ac_debug') === '1';
  } catch {
    return false;
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error(tRaw('unknownError')) };
  }

  componentDidCatch(error, info) {
    try {
      console.error(error, info);
    } catch {
      void 0;
    }
    try {
      const payload = {
        message: String(error?.message || error || ''),
        stack: String(error?.stack || ''),
        componentStack: String(info?.componentStack || ''),
        href: typeof window !== 'undefined' ? String(window.location.href || '') : '',
        ts: Date.now()
      };
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('ac_last_error', JSON.stringify(payload));
      }
    } catch {
      void 0;
    }
  }

  render() {
    const error = this.state?.error;
    if (!error) return this.props.children;

    const debug = isDebugEnabled();
    const details = String(error?.stack || error?.message || error);
    const lang = (useI18nStore.getState?.().lang || 'en');
    const t = (key, vars) => {
      const table = STRINGS[lang] || STRINGS.en;
      const raw = table?.[key] ?? STRINGS.en?.[key] ?? key;
      if (!vars || typeof raw !== 'string') return raw;
      return Object.keys(vars).reduce((acc, k) => acc.split(`{{${k}}}`).join(String(vars[k])), raw);
    };

    return (
      <div className="min-h-screen bg-zinc-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">{t('somethingWentWrong')}</div>
            <div className="mt-1 text-sm text-zinc-600">{t('somethingWentWrongHint')}</div>
            {debug ? (
              <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
                {details}
              </pre>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => window.location.reload()}
              >
                {t('reload')}
              </button>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => this.setState({ error: null })}
              >
                {t('tryAgain')}
              </button>
              {debug ? (
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(details);
                    } catch {
                      void 0;
                    }
                  }}
                >
                  {t('copyError')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
