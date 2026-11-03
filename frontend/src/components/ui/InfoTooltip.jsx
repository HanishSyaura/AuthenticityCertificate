import React from 'react';

export default function InfoTooltip({ content, text, message, children, className = '' }) {
  const description = content ?? text ?? message;

  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      {children || (
        <span
          aria-label="Information"
          tabIndex={0}
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 outline-none focus:ring-2 focus:ring-[var(--ac-brand)]"
        >
          i
        </span>
      )}

      {description ? (
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[280px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          {description}
        </span>
      ) : null}
    </span>
  );
}
