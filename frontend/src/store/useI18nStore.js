import { create } from 'zustand';

const KEY = 'ac_lang';

function normalize(lang) {
  if (lang === 'ms') return 'ms';
  if (lang === 'zh') return 'zh';
  return 'en';
}

function readLang() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return normalize(stored);

    const candidates = [];
    if (typeof navigator !== 'undefined') {
      if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
      if (navigator.language) candidates.push(navigator.language);
    }

    for (const c of candidates) {
      const v = String(c || '').toLowerCase();
      if (v.startsWith('ms')) return 'ms';
    }

    return 'en';
  } catch (e) {
    void e;
    return 'en';
  }
}

function writeLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch (e) {
    void e;
  }
}

const useI18nStore = create((set) => ({
  lang: readLang(),
  setLang: (lang) => {
    const next = normalize(lang);
    writeLang(next);
    set({ lang: next });
  }
}));

export default useI18nStore;
