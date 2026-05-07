import useI18nStore from '../store/useI18nStore';
import { STRINGS } from './strings';

export function tRaw(key, vars) {
  const lang = useI18nStore.getState?.().lang || 'en';
  const table = STRINGS[lang] || STRINGS.en;
  const raw = table?.[key] ?? STRINGS.en?.[key] ?? key;
  if (!vars || typeof raw !== 'string') return raw;
  return Object.keys(vars).reduce((acc, k) => acc.split(`{{${k}}}`).join(String(vars[k])), raw);
}

