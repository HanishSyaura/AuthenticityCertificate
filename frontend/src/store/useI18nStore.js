import { create } from 'zustand';

const KEY = 'ac_lang';
const KEY_SET = 'ac_lang_set';

function normalize(lang) {
  if (lang === 'ms') return 'ms';
  if (lang === 'zh') return 'zh';
  return 'en';
}

function readLang() {
  try {
    const stored = localStorage.getItem(KEY);
    const setByUser = localStorage.getItem(KEY_SET);
    if (stored && setByUser === '1') return normalize(stored);
    return 'en';
  } catch (e) {
    void e;
    return 'en';
  }
}

function writeLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
    localStorage.setItem(KEY_SET, '1');
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
