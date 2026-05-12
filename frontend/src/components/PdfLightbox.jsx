import React, { useEffect } from 'react';
import { useT } from '../i18n/useT';
import { resolvePublicMediaUrl } from '../utils/apiBase';

export default function PdfLightbox({ src, title = 'PDF', onClose }) {
  const { t } = useT();
  const resolvedSrc = resolvePublicMediaUrl(src);
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
          <a href={resolvedSrc} target="_blank" rel="noreferrer" className="text-xs font-semibold text-white underline">
            {t('openInNewTab')}
          </a>
        </div>
        <iframe title={title} src={resolvedSrc} className="h-[calc(100vh-6rem)] w-full rounded bg-white" />
      </div>
    </div>
  );
}
