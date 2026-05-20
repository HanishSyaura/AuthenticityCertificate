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
      // Use the legacy worker for better compatibility with older mobile browsers
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
      const w = Math.floor(el.clientWidth || 0);
      const h = Math.floor(el.clientHeight || 0);
      setContainerW(w);
      setContainerH(h);
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
        const pad = 16;
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        
        // Add a timeout for the render task
        const renderTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Render timeout')), 5000)
        );

        await Promise.race([task.promise, renderTimeout]);
        
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
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-2 text-sm text-zinc-500">{error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="rounded bg-zinc-800 px-4 py-2 text-xs font-semibold text-white"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (loading && !numPages) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
        <div className="mt-3 text-xs text-zinc-500">{t('loading')}</div>
      </div>
    );
  }

  if (!numPages) {
    return <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-500">{t('operationFailed')}</div>;
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-auto bg-zinc-200/50">
      <div className="flex min-h-full w-full items-center justify-center p-4">
        <canvas ref={canvasRef} className="block max-w-none bg-white shadow-xl shadow-black/10" />
      </div>
    </div>
  );
}

export default function PdfLightbox({ src, title = 'PDF', onClose }) {
  const { t } = useT();
  const token = useAdminAuthStore((s) => s.token);
  const resolvedSrc = resolvePublicMediaUrl(src);
  const [blobUrl, setBlobUrl] = useState('');
  const [pdfData, setPdfData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [canvasFailed, setCanvasFailed] = useState(false);

  useEffect(() => {
    if (loading || canvasFailed || !pdfData) return undefined;
    const tid = setTimeout(() => {
      // If it stays on page 0 or the first page doesn't render, trigger fallback
      if (!numPages || numPages === 0) {
        console.warn('[PdfLightbox] Rendering is stuck, falling back to native viewer');
        setCanvasFailed(true);
      }
    }, 4500);
    return () => clearTimeout(tid);
  }, [loading, canvasFailed, pdfData, numPages]);

  const finalSrc = useMemo(() => blobUrl || resolvedSrc || '', [blobUrl, resolvedSrc]);
  const useCanvas = useMemo(() => !canvasFailed, [canvasFailed]);

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
    let alive = true;
    const ctrl = new AbortController();
    setError('');
    setLoading(true);
    setBlobUrl('');
    setPdfData(null);
    setZoom(1);
    setPage(1);
    setNumPages(0);
    setCanvasFailed(false);

    const run = async () => {
      try {
        const res = await fetch(resolvedSrc, {
          signal: ctrl.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        const nextData = new Uint8Array(buf);
        const next = URL.createObjectURL(blob);
        if (!alive) {
          URL.revokeObjectURL(next);
          return;
        }
        setBlobUrl(next);
        setPdfData(nextData);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        console.error('[PdfLightbox] Fetch error:', e);
        const msg = e?.message ? String(e.message) : t('operationFailed');
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
  }, [resolvedSrc, t, token]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!resolvedSrc) return null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex h-full w-full flex-col overflow-hidden sm:mx-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-xl sm:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Professional Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-zinc-900 px-3 py-2 text-white">
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              aria-label="Close" 
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10" 
              onClick={() => onClose?.()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="hidden min-w-0 flex-1 truncate text-sm font-medium sm:block">{title}</div>
          </div>

          {useCanvas && numPages > 0 && (
            <div className="flex items-center gap-1 sm:gap-4">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 disabled:opacity-30"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ‹
                </button>
                <span className="text-xs font-medium tabular-nums">
                  {page} / {numPages}
                </span>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 disabled:opacity-30"
                  onClick={() => setPage((p) => Math.min(numPages, p + 1))}
                  disabled={page >= numPages}
                >
                  ›
                </button>
              </div>
              <div className="h-4 w-px bg-white/20" />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                >
                  −
                </button>
                <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <a 
              href={finalSrc} 
              download 
              className="hidden rounded bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 sm:block"
            >
              Download
            </a>
            <a href={finalSrc} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10" title={t('openInNewTab')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-zinc-200">
          {useCanvas && pdfData instanceof Uint8Array ? (
            <PdfCanvasViewer
              data={pdfData}
              zoom={zoom}
              page={page}
              onNumPagesChange={setNumPages}
              onError={() => setCanvasFailed(true)}
            />
          ) : (
            <iframe 
              title={title} 
              src={finalSrc} 
              className="h-full w-full border-none bg-white"
              onLoad={() => setLoading(false)}
            />
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
