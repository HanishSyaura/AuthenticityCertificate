import React from 'react';
import useI18nStore from '../store/useI18nStore';

export default function LanguageSwitcher({ size = 'sm' }) {
  const { lang, setLang } = useI18nStore((s) => ({ lang: s.lang, setLang: s.setLang }));
  const cls = size === 'xs' ? 'text-[11px] px-2 py-1' : 'text-xs px-3 py-2';

  return (
    <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`${cls} rounded-lg font-semibold transition ${lang === 'en' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-50'}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang('ms')}
        className={`${cls} rounded-lg font-semibold transition ${lang === 'ms' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-50'}`}
      >
        BM
      </button>
      <button
        type="button"
        onClick={() => setLang('zh')}
        className={`${cls} rounded-lg font-semibold transition ${lang === 'zh' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-50'}`}
      >
        中文
      </button>
    </div>
  );
}

