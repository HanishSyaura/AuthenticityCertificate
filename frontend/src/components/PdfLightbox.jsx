import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/useT';
import { resolvePublicMediaUrl } from '../utils/apiBase';

export default function PdfLightbox({ src, title = 'PDF', onClose }) {
  const { t } = useT();
  const resolvedSrc = resolvePublicMediaUrl(src);

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

  if (!resolvedSrc) return null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-900 sm:mx-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-xl sm:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Simple & Clean Toolbar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10" 
              onClick={() => onClose?.()}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <span className="max-w-[200px] truncate text-sm font-semibold sm:max-w-md">{title}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href={resolvedSrc} 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-2 text-xs font-bold text-white hover:underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
              {t('openInNewTab')}
            </a>
          </div>
        </div>

        {/* The "Direct Pull" Viewer */}
        <div className="min-h-0 flex-1 bg-white">
          <iframe 
            title={title} 
            src={`${resolvedSrc}#toolbar=1`} 
            className="h-full w-full border-none"
          />
        </div>
      </div>
    </div>,
    portalTarget
  );
}
