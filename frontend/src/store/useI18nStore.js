import { create } from 'zustand';

const KEY = 'ac_lang';

function normalize(lang) {
  if (lang === 'ms') return 'ms';
  if (lang === 'zh') return 'zh';
  return 'en';
}

function readLang() {
  try {
    return normalize(localStorage.getItem(KEY) || 'en');
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
