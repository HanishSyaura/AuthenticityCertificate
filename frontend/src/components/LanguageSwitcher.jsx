import React from 'react';
import useI18nStore from '../store/useI18nStore';
import { useT } from '../i18n/useT';

export default function LanguageSwitcher({ size = 'sm' }) {
  const { lang, setLang } = useI18nStore((s) => ({ lang: s.lang, setLang: s.setLang }));
  const { t } = useT();
  const options = [
    { code: 'en', shortLabel: 'EN', labelKey: 'languageEnglish' },
    { code: 'ms', shortLabel: 'BM', labelKey: 'languageMalay' },
    { code: 'zh', shortLabel: '中文', labelKey: 'languageChinese' },
  ];
  const cls =
    size === 'xs'
      ? 'min-h-[36px] px-3 py-2 text-xs sm:min-h-0 sm:px-2.5 sm:py-1.5 sm:text-[11px]'
      : size === 'md'
        ? 'min-h-[40px] px-3.5 py-2.5 text-sm sm:min-h-0 sm:px-3.5 sm:py-2 sm:text-sm'
        : 'min-h-[38px] px-3 py-2 text-sm';

  return (
    <div className="inline-flex flex-nowrap whitespace-nowrap rounded-2xl border border-white/80 bg-white/92 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      {options.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => setLang(opt.code)}
          aria-label={t(opt.labelKey)}
          title={t(opt.labelKey)}
          aria-pressed={lang === opt.code}
          style={
            lang === opt.code
              ? {
                  background: 'linear-gradient(135deg, var(--ac-brand) 0%, var(--ac-brand-deep) 100%)',
                  boxShadow: '0 10px 24px rgba(var(--ac-brand-rgb), 0.24)'
                }
              : undefined
          }
          className={`${cls} touch-manipulation whitespace-nowrap rounded-xl font-semibold tracking-[0.02em] transition ${
            lang === opt.code
              ? 'text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {opt.shortLabel}
        </button>
      ))}
    </div>
  );
}
