import React, { useEffect, useRef, useState } from 'react';

export default function RowActionsMenu({ items, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setOpen(false);
    };

    const onDocKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [open]);

  const safeItems = (Array.isArray(items) ? items : []).filter((x) => x && x.label);

  return (
    <div ref={rootRef} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
        aria-label={ariaLabel || 'Actions'}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg shadow-zinc-900/10">
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
        </div>
      ) : null}
    </div>
  );
}

