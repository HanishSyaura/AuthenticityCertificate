import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/useT';
import { resolvePublicMediaUrl } from '../utils/apiBase';

function normalizeErrorMessage(input, fallback) {
  if (!input) return fallback;
  if (typeof input === 'string') return input;
  if (input?.message) return String(input.message);
  return fallback;
}

export default function PdfLightbox({ src, title = 'PDF', onClose }) {
  const { t } = useT();
  const resolvedSrc = resolvePublicMediaUrl(src);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pages, setPages] = useState([]);

  const finalSrc = useMemo(() => resolvedSrc || '', [resolvedSrc]);

  useEffect(() => {
    if (!resolvedSrc) return undefined;
    const prevOverflow = document?.body?.style?.overflow ?? '';
    if (document?.body?.style) document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (document?.body?.style) document.body.style.overflow = prevOverflow;
    };
  }, [onClose, resolvedSrc]);

  useEffect(() => {
    if (!resolvedSrc) return undefined;
    const ctrl = new AbortController();
    let alive = true;

    setLoading(true);
    setError('');
    setPages([]);

    const run = async () => {
      try {
        const url = `/api/public/pdf-preview?src=${encodeURIComponent(resolvedSrc)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
        if (!json?.success) throw new Error(json?.message || t('operationFailed'));
        const data = json?.data || null;
        const nextPages = Array.isArray(data?.pages) ? data.pages : [];
        if (!nextPages.length) throw new Error(t('operationFailed'));
        setPages(nextPages);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        const msg = normalizeErrorMessage(e, t('operationFailed'));
        if (!alive) return;
        setError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [resolvedSrc, t]);

  if (!resolvedSrc) return null;
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-900 sm:mx-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-xl sm:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/10" onClick={() => onClose?.()}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
          </div>
          <div className="flex flex-none items-center gap-2">
            <div className="min-w-[4.25rem] text-center text-xs tabular-nums">{pages.length ? `${pages.length}p` : '—'}</div>
            <a href={finalSrc} target="_blank" rel="noreferrer" className="rounded px-2 py-1 text-xs font-semibold hover:bg-white/10">
              {t('openInNewTab')}
            </a>
            <a href={finalSrc} download className="rounded px-2 py-1 text-xs font-semibold hover:bg-white/10">
              Download
            </a>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-zinc-100">
          {error ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="text-sm text-zinc-700">{error}</div>
              <a href={finalSrc} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 underline">
                {t('openInNewTab')}
              </a>
              <a href={finalSrc} download className="text-sm font-semibold text-blue-700 underline">
                Download
              </a>
            </div>
          ) : loading ? (
            <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{t('loading')}</div>
          ) : (
            <div className="h-full w-full overflow-auto p-4">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                {pages.map((p, idx) => (
                  <img
                    key={`${p}-${idx}`}
                    src={p}
                    alt={`${title} ${idx + 1}`}
                    className="w-full rounded bg-white shadow"
                    loading={idx < 2 ? 'eager' : 'lazy'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
