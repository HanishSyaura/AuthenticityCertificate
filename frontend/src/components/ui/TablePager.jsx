import React, { useMemo } from 'react';
import { useT } from '../../i18n/useT';

export default function TablePager({ offset, limit, total, loading, onOffsetChange, onLimitChange, limitOptions }) {
  const { t } = useT();
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeLimit = Math.max(1, Number(limit) || 1);
  const safeOffset = Math.max(0, Math.min(Number(offset) || 0, Math.max(0, safeTotal - 1)));
  const from = safeTotal === 0 ? 0 : safeOffset + 1;
  const to = safeTotal === 0 ? 0 : Math.min(safeTotal, safeOffset + safeLimit);
  const page = safeTotal === 0 ? 0 : Math.floor(safeOffset / safeLimit) + 1;
  const pages = safeTotal === 0 ? 0 : Math.max(1, Math.ceil(safeTotal / safeLimit));
  const canPrev = safeOffset > 0;
  const canNext = safeOffset + safeLimit < safeTotal;

  const options = useMemo(() => {
    const base = Array.isArray(limitOptions) && limitOptions.length > 0 ? limitOptions : [10, 20, 50, 100, 200];
    const list = base.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
    if (!list.includes(safeLimit)) list.push(safeLimit);
    return Array.from(new Set(list)).sort((a, b) => a - b);
  }, [limitOptions, safeLimit]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
      <div>
        {t('showingCount', { from, to, total: safeTotal })}{' '}
        {pages > 0 ? <span className="text-zinc-400">• Page {page} / {pages}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{t('rowsPerPage')}</span>
          <select
            value={String(safeLimit)}
            disabled={loading}
            onChange={(e) => {
              const next = Math.max(1, Number(e.target.value) || safeLimit);
              if (typeof onLimitChange === 'function') onLimitChange(next);
            }}
            className="ac-input w-[88px] px-2 py-1 text-xs"
          >
            {options.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ac-btn ac-btn-soft px-3 py-2 text-xs"
          disabled={loading || !canPrev}
          onClick={() => {
            if (typeof onOffsetChange !== 'function') return;
            onOffsetChange(Math.max(0, safeOffset - safeLimit));
          }}
        >
          {t('prev')}
        </button>
        <button
          type="button"
          className="ac-btn ac-btn-soft px-3 py-2 text-xs"
          disabled={loading || !canNext}
          onClick={() => {
            if (typeof onOffsetChange !== 'function') return;
            onOffsetChange(safeOffset + safeLimit);
          }}
        >
          {t('next')}
        </button>
      </div>
    </div>
  );
}
