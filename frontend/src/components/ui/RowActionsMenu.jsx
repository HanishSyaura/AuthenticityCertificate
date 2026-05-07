import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n/useT';

function clamp(n, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(n, max));
}

export default function RowActionsMenu({ items, ariaLabel }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []).filter((x) => x && x.label), [items]);

  const updatePosition = () => {
    const root = rootRef.current;
    const menu = menuRef.current;
    if (!root || !menu) return;

    const r = root.getBoundingClientRect();
    const mw = menu.offsetWidth || 0;
    const mh = menu.offsetHeight || 0;

    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const maxLeft = vw - margin - mw;
    let left = clamp(r.right - mw, margin, maxLeft);

    const bottomTop = r.bottom + margin;
    const topTop = r.top - margin - mh;
    const canOpenBottom = bottomTop + mh <= vh - margin;

    const maxTop = vh - margin - mh;
    let top = clamp(canOpenBottom ? bottomTop : topTop, margin, maxTop);

    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, safeItems.length]);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e) => {
      const root = rootRef.current;
      const menu = menuRef.current;
      if (root?.contains(e.target)) return;
      if (menu?.contains(e.target)) return;
      setOpen(false);
    };

    const onDocKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const onWin = () => updatePosition();

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
        aria-label={ariaLabel || t('actions')}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: pos.top, left: pos.left }}
              className="z-40 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg shadow-zinc-900/10"
            >
              <div className="py-1">
                {safeItems.map((it, idx) => {
                  const danger = it.tone === 'danger';
                  const disabled = Boolean(it.disabled);
                  return (
                    <button
                      key={it.key || `${idx}-${it.label}`}
                      type="button"
                      disabled={disabled}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        danger ? 'text-rose-700 hover:bg-rose-50' : 'text-zinc-700 hover:bg-zinc-50'
                      } ${disabled ? 'cursor-not-allowed opacity-50 hover:bg-white' : ''}`.trim()}
                      onClick={async () => {
                        if (disabled) return;
                        setOpen(false);
                        await it.onSelect?.();
                      }}
                    >
                      <span className="truncate">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
