import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/useT';
import { resolvePublicMediaUrl } from '../utils/apiBase';
import useAdminAuthStore from '../store/useAdminAuthStore';

export default function PdfLightbox({ src, title = 'PDF', onClose }) {
  const { t } = useT();
  const token = useAdminAuthStore((s) => s.token);
  const resolvedSrc = resolvePublicMediaUrl(src);
  const [blobUrl, setBlobUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const iframeSrc = useMemo(() => blobUrl || '', [blobUrl]);
  useEffect(() => {
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
  }, [onClose]);

  if (!resolvedSrc) return null;

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setError('');
    setLoading(true);
    setBlobUrl('');

    const run = async () => {
      try {
        const res = await fetch(resolvedSrc, {
          signal: ctrl.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const blob = await res.blob();
        const next = URL.createObjectURL(blob);
        if (!alive) {
          URL.revokeObjectURL(next);
          return;
        }
        setBlobUrl(next);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        const msg = e?.message ? String(e.message) : t('operationFailed');
        if (!alive) return;
        setError(msg);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    void run();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [resolvedSrc, t, token]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <button
        type="button"
        className="absolute right-4 top-4 rounded bg-black/50 px-3 py-1 text-sm text-white"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
      >
        ×
      </button>
      <div className="h-full max-h-[calc(100vh-2rem)] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="truncate text-sm font-semibold text-white">{title}</div>
          <a href={iframeSrc || resolvedSrc} target="_blank" rel="noreferrer" className="text-xs font-semibold text-white underline">
            {t('openInNewTab')}
          </a>
        </div>
        {iframeSrc ? (
          <iframe title={title} src={iframeSrc} className="h-[calc(100vh-6rem)] w-full rounded bg-white" />
        ) : (
          <div className="flex h-[calc(100vh-6rem)] w-full items-center justify-center rounded bg-white text-sm text-zinc-700">
            {loading ? t('loading') : error || t('operationFailed')}
          </div>
        )}
      </div>
    </div>
  );
}
