import { useMemo } from 'react';
import useI18nStore from '../store/useI18nStore';
import { STRINGS } from './strings';

export function useT() {
  const lang = useI18nStore((s) => s.lang);

  const t = useMemo(() => {
    return (key, vars) => {
      const table = STRINGS[lang] || STRINGS.en;
      const raw = table?.[key] ?? STRINGS.en?.[key] ?? key;
      if (!vars || typeof raw !== 'string') return raw;
      return Object.keys(vars).reduce((acc, k) => {
        return acc.split(`{{${k}}}`).join(String(vars[k]));
      }, raw);
    };
  }, [lang]);

  const locale = useMemo(() => {
    if (lang === 'ms') return 'ms-MY';
    if (lang === 'zh') return 'zh-CN';
    return 'en-MY';
  }, [lang]);

  return { t, lang, locale };
}
