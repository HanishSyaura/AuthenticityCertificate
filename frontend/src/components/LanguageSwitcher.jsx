import React from 'react';
import useI18nStore from '../store/useI18nStore';
import { useT } from '../i18n/useT';

export default function LanguageSwitcher({ size = 'sm' }) {
  const { lang, setLang } = useI18nStore((s) => ({ lang: s.lang, setLang: s.setLang }));
  const { t } = useT();
  const cls =
    size === 'xs'
      ? 'min-h-[36px] px-3 py-2 text-xs sm:min-h-0 sm:px-2 sm:py-1 sm:text-[11px]'
      : size === 'md'
        ? 'min-h-[40px] px-3.5 py-2.5 text-sm sm:min-h-0 sm:px-3 sm:py-2 sm:text-sm'
        : 'min-h-[38px] px-3 py-2 text-sm';

  return (
    <div className="inline-flex flex-nowrap whitespace-nowrap rounded-xl border border-zinc-200/80 bg-white p-1 shadow-sm shadow-zinc-900/5">
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`${cls} touch-manipulation whitespace-nowrap rounded-lg font-semibold transition ${lang === 'en' ? 'bg-brand-600 text-white shadow-sm shadow-zinc-900/10' : 'text-zinc-700 hover:bg-zinc-50'}`}
      >
        {t('languageEnglish')}
      </button>
      <button
        type="button"
        onClick={() => setLang('ms')}
        className={`${cls} touch-manipulation whitespace-nowrap rounded-lg font-semibold transition ${lang === 'ms' ? 'bg-brand-600 text-white shadow-sm shadow-zinc-900/10' : 'text-zinc-700 hover:bg-zinc-50'}`}
      >
        {t('languageMalay')}
      </button>
      <button
        type="button"
        onClick={() => setLang('zh')}
        className={`${cls} touch-manipulation whitespace-nowrap rounded-lg font-semibold transition ${lang === 'zh' ? 'bg-brand-600 text-white shadow-sm shadow-zinc-900/10' : 'text-zinc-700 hover:bg-zinc-50'}`}
      >
        {t('languageChinese')}
      </button>
    </div>
  );
}
