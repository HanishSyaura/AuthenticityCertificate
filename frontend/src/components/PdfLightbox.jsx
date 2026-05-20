import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/useT';
import { resolvePublicMediaUrl } from '../utils/apiBase';
import useAdminAuthStore from '../store/useAdminAuthStore';

let workerSrcPromise = null;
let workerSrcBlobUrl = '';

function getPdfAssetsBaseUrl() {
  const base = (import.meta?.env?.BASE_URL || '/').trim() || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function getPdfDocumentParams(data) {
  const base = getPdfAssetsBaseUrl();
  return {
    data,
    cMapUrl: `${base}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
    disableRange: true,
    disableStream: true,
    disableIndexedDb: true
  };
}

async function ensurePdfWorkerSrc(pdfjs) {
  const existing = pdfjs?.GlobalWorkerOptions?.workerSrc;
  if (typeof existing === 'string' && existing.trim()) return existing.trim();
  if (workerSrcBlobUrl) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrcBlobUrl;
    } catch {
    }
    return workerSrcBlobUrl;
  }
  if (!workerSrcPromise) {
    workerSrcPromise = (async () => {
      const workerUrl = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
      const res = await fetch(workerUrl);
      if (!res.ok) throw new Error(`Failed to load pdf.worker (${res.status})`);
      const code = await res.text();
      const blob = new Blob([code], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      workerSrcBlobUrl = blobUrl;
      return blobUrl;
    })().catch((e) => {
      workerSrcPromise = null;
      throw e;
    });
  }
  const src = await workerSrcPromise;
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = src;
  } catch {
  }
  return src;
}

function PdfCanvasViewer({ data, zoom = 1, page = 1, onNumPagesChange, onError }) {
  const { t } = useT();
  const containerRef = useRef(null);
  const onNumPagesChangeRef = useRef(onNumPagesChange);
  const onErrorRef = useRef(onError);
  const docRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    onNumPagesChangeRef.current = onNumPagesChange;
    onErrorRef.current = onError;
  }, [onNumPagesChange, onError]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = Number(el.clientWidth || 0);
      const h = Number(el.clientHeight || 0);
      setContainerW(Number.isFinite(w) && w > 0 ? w : 0);
      setContainerH(Number.isFinite(h) && h > 0 ? h : 0);
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [numPages]);

  useEffect(() => {
    let alive = true;
    setError('');
    setNumPages(0);
    const prevDoc = docRef.current;
    docRef.current = null;
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel?.();
      } catch {
      }
      renderTaskRef.current = null;
    }
    if (prevDoc) {
      try {
        prevDoc.destroy?.();
      } catch {
      }
    }
    if (!(data instanceof Uint8Array) || data.length === 0) return () => void 0;

    const run = async () => {
      setLoading(true);
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        await ensurePdfWorkerSrc(pdfjs);
        let doc = null;
        try {
          doc = await pdfjs.getDocument(getPdfDocumentParams(data)).promise;
        } catch {
          doc = await pdfjs.getDocument({ ...getPdfDocumentParams(data), disableWorker: true }).promise;
        }
        if (!alive) {
          try {
            doc.destroy?.();
          } catch {
          }
          return;
        }
        docRef.current = doc;
        const total = Number(doc?.numPages) > 0 ? Number(doc.numPages) : 0;
        setNumPages(total);
        onNumPagesChangeRef.current?.(total);
      } catch (e) {
        console.error('[PdfCanvasViewer] Load error:', e);
        const msg = e?.message ? String(e.message) : t('operationFailed');
        if (!alive) return;
        setError(msg);
        onErrorRef.current?.(msg);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();
    return () => {
      alive = false;
      const doc = docRef.current;
      docRef.current = null;
      if (doc) {
        try {
          doc.destroy?.();
        } catch {
        }
      }
    };
  }, [data, t]);

  useEffect(() => {
    let alive = true;
    if (!(data instanceof Uint8Array) || data.length === 0) return () => void 0;
    if (!numPages) return () => void 0;
    const doc = docRef.current;
    if (!doc) return () => void 0;
    const pageSafe = Math.max(1, Math.min(Number(page) || 1, numPages));

    const run = async () => {
      try {
        await new Promise((r) => window.requestAnimationFrame(r));
        const canvas = canvasRef.current;
        if (!(canvas instanceof HTMLCanvasElement)) return;

        const container = containerRef.current;
        const rect = container?.getBoundingClientRect?.();
        const rectW = Math.floor(rect?.width || 0);
        const rectH = Math.floor(rect?.height || 0);

        // If container is 0, retry up to 5 times
        if (rectW <= 0 && retryCount < 5) {
          setTimeout(() => setRetryCount((c) => c + 1), 200);
          return;
        }

        const fallbackW = typeof window !== 'undefined' ? Math.max(1, Math.floor(Number(window.innerWidth || 0))) : 0;
        const fallbackH = typeof window !== 'undefined' ? Math.max(1, Math.floor(Number(window.innerHeight || 0) - 120)) : 0;
        
        const measuredW = rectW > 0 ? rectW : containerW > 0 ? containerW : fallbackW;
        const measuredH = rectH > 0 ? rectH : containerH > 0 ? containerH : fallbackH;
        if (!measuredW || !measuredH) return;

        const pdfPage = await doc.getPage(pageSafe);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const pad = 24;
        const availW = Math.max(1, Math.floor(measuredW - pad * 2));
        const availH = Math.max(1, Math.floor(measuredH - pad * 2));
        const fitScale = Math.max(
          0.1,
          Math.min(availW / Math.max(1, baseViewport.width), availH / Math.max(1, baseViewport.height))
        );
        const z = Math.max(0.25, Math.min(6, Number(zoom) || 1));
        const viewport = pdfPage.getViewport({ scale: Math.max(0.1, fitScale * z) });

        const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.max(1, Number(window.devicePixelRatio) || 1) : 1;
        const cssW = Math.max(1, Math.floor(viewport.width));
        const cssH = Math.max(1, Math.floor(viewport.height));
        canvas.width = Math.max(1, Math.floor(cssW * dpr));
        canvas.height = Math.max(1, Math.floor(cssH * dpr));
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Canvas not supported');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel?.();
          } catch {
          }
          renderTaskRef.current = null;
        }
        const task = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (!alive) return;
        renderTaskRef.current = null;
        try {
          pdfPage.cleanup();
        } catch {
        }
      } catch (e) {
        console.error('[PdfCanvasViewer] Render error:', e);
        const msg = e?.message ? String(e.message) : t('operationFailed');
        if (!alive) return;
        setError(msg);
        onErrorRef.current?.(msg);
      }
    };

    void run();
    return () => {
      alive = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel?.();
        } catch {
        }
        renderTaskRef.current = null;
      }
    };
  }, [containerH, containerW, data, numPages, page, t, zoom, retryCount]);

  if (error) {
    return <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{error}</div>;
  }

  if (loading && !numPages) {
    return <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{t('loading')}</div>;
  }

  if (!numPages) {
    return <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{t('operationFailed')}</div>;
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-auto bg-white">
      <div className="flex min-h-full w-full items-center justify-center p-3">
        <canvas ref={canvasRef} className="block max-w-none rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-900/5" />
      </div>
    </div>
  );
}

export default function PdfLightbox({ src, title = 'PDF', onClose }) {
  const { t } = useT();
  const token = useAdminAuthStore((s) => s.token);
  const resolvedSrc = resolvePublicMediaUrl(src);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Use the direct URL for the iframe to be as stable as possible
  const finalSrc = useMemo(() => {
    if (!resolvedSrc) return '';
    // If we have a token, we might need it for some restricted PDFs, 
    // but for public verify page, direct URL is best.
    return resolvedSrc;
  }, [resolvedSrc]);

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
    <div className="fixed inset-0 z-[9999] bg-black/70 sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex h-full w-full flex-col sm:mx-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-black/80 px-3 py-3 text-white backdrop-blur sm:rounded-t-xl sm:bg-transparent sm:px-4 sm:py-2 sm:backdrop-blur-0">
          <button type="button" aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70" onClick={() => onClose?.()}>
            ×
          </button>
          <div className="min-w-0 flex-1 truncate text-center text-sm font-semibold sm:text-left">{title}</div>
          <div className="flex items-center gap-4">
            <a 
              href={finalSrc} 
              download 
              className="hidden rounded bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 sm:block"
            >
              Download
            </a>
            <a href={finalSrc} target="_blank" rel="noreferrer" className="text-xs font-semibold text-white underline">
              {t('openInNewTab')}
            </a>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-zinc-100 sm:rounded-b-xl">
          <iframe 
            title={title} 
            src={finalSrc} 
            className="h-full w-full border-none bg-white"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>,
    portalTarget
  );
}
