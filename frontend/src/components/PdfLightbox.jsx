import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/useT';
import { resolvePublicMediaUrl } from '../utils/apiBase';

function GoogleDocsViewer({ src }) {
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const viewerUrl = useMemo(() => {
    if (!src) return '';
    const encoded = encodeURIComponent(src);
    return `https://docs.google.com/gview?url=${encoded}&embedded=true&hl=en`;
  }, [src]);

  if (!viewerUrl) return null;

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
            <span className="text-sm text-zinc-500">Loading PDF...</span>
          </div>
        </div>
      )}
      <iframe
        src={viewerUrl}
        title="PDF Viewer"
        className="h-full w-full border-none"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError('Failed to load PDF viewer');
        }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
          <div className="text-center">
            <p className="mb-2 text-sm text-red-500">{error}</p>
            <a href={src} download className="text-sm text-blue-600 underline">
              Download PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

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
              download 
              className="flex items-center gap-2 text-xs font-bold text-white hover:underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download
            </a>
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

        {/* Google Docs Viewer - Works on all devices */}
        <div className="min-h-0 flex-1 bg-white">
          <GoogleDocsViewer src={resolvedSrc} />
        </div>
      </div>
    </div>,
    portalTarget
  );
}
