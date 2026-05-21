import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/useT';
import useAdminAuthStore from '../store/useAdminAuthStore';
import { resolvePublicMediaUrl } from '../utils/apiBase';

let workerSrcPromise = null;
let workerSrcBlobUrl = '';

function clamp(n, min, max) {
  const v = Number(n) || 0;
  return Math.max(min, Math.min(max, v));
}

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
    disableAutoFetch: true,
    disableFontFace: true,
    useSystemFonts: true,
    disableIndexedDb: true,
    disableWorker: true
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

function PdfCanvasViewer({ data, page, zoom, onNumPagesChange, onRenderStateChange }) {
  const { t } = useT();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const docRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    onNumPagesChange?.(numPages);
  }, [numPages, onNumPagesChange]);

  useEffect(() => {
    let alive = true;
    setError('');
    setLoading(true);
    setNumPages(0);
    onRenderStateChange?.({ rendered: false, error: '' });

    const prevTask = renderTaskRef.current;
    if (prevTask) {
      try {
        prevTask.cancel?.();
      } catch {
      }
      renderTaskRef.current = null;
    }

    const prevDoc = docRef.current;
    docRef.current = null;
    if (prevDoc) {
      try {
        prevDoc.destroy?.();
      } catch {
      }
    }

    const run = async () => {
      try {
        if (!(data instanceof Uint8Array) || data.length === 0) throw new Error(t('operationFailed'));
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const doc = await pdfjs.getDocument(getPdfDocumentParams(data)).promise;
        if (!alive) {
          try {
            doc.destroy?.();
          } catch {
          }
          return;
        }
        docRef.current = doc;
        setNumPages(Number(doc?.numPages) || 0);
      } catch (e) {
        const msg = e?.message ? String(e.message) : e ? String(e) : t('operationFailed');
        console.error('[PdfCanvasViewer] load failed', e);
        if (!alive) return;
        setError(msg);
        onRenderStateChange?.({ rendered: false, error: msg });
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [data, onRenderStateChange, t]);

  useEffect(() => {
    let alive = true;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !(canvas instanceof HTMLCanvasElement)) return () => void 0;
    if (!numPages) return () => void 0;

    const pageSafe = clamp(page, 1, numPages);
    const z = clamp(zoom, 0.5, 4);

    const run = async () => {
      try {
        onRenderStateChange?.({ rendered: false, error: '' });

        await new Promise((r) => window.requestAnimationFrame(r));
        if (!alive) return;

        const container = containerRef.current;
        const rect = container?.getBoundingClientRect?.();
        const rectW = Math.floor(rect?.width || 0);
        const rectH = Math.floor(rect?.height || 0);
        const fallbackW = Math.max(1, Math.floor(Number(window.innerWidth || 0) - 32));
        const fallbackH = Math.max(1, Math.floor(Number(window.innerHeight || 0) - 120));
        const viewW = rectW > 0 ? rectW : fallbackW;
        const viewH = rectH > 0 ? rectH : fallbackH;

        const pdfPage = await doc.getPage(pageSafe);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const pad = 16;
        const availW = Math.max(1, Math.floor(viewW - pad * 2));
        const availH = Math.max(1, Math.floor(viewH - pad * 2));
        const fitScale = Math.max(
          0.1,
          Math.min(availW / Math.max(1, baseViewport.width), availH / Math.max(1, baseViewport.height))
        );
        const viewport = pdfPage.getViewport({ scale: Math.max(0.1, fitScale * z) });

        const cssW = Math.max(1, Math.floor(viewport.width));
        const cssH = Math.max(1, Math.floor(viewport.height));
        const requestedDpr = clamp(window.devicePixelRatio || 1, 1, 2);
        const maxPixels = 16_000_000;
        const maxDprByPixels = Math.max(1, Math.floor(Math.sqrt(maxPixels / Math.max(1, cssW * cssH)) * 100) / 100);
        const dpr = Math.min(requestedDpr, maxDprByPixels);

        canvas.width = Math.max(1, Math.floor(cssW * dpr));
        canvas.height = Math.max(1, Math.floor(cssH * dpr));
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error(t('operationFailed'));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const prevTask = renderTaskRef.current;
        if (prevTask) {
          try {
            prevTask.cancel?.();
          } catch {
          }
          renderTaskRef.current = null;
        }

        const task = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;

        if (!alive) return;
        onRenderStateChange?.({ rendered: true, error: '' });
      } catch (e) {
        const msg = e?.message ? String(e.message) : t('operationFailed');
        console.error('[PdfCanvasViewer] render failed', e);
        if (!alive) return;
        setError(msg);
        onRenderStateChange?.({ rendered: false, error: msg });
      }
    };

    void run();
    return () => {
      alive = false;
      const prevTask = renderTaskRef.current;
      if (prevTask) {
        try {
          prevTask.cancel?.();
        } catch {
        }
        renderTaskRef.current = null;
      }
    };
  }, [numPages, onRenderStateChange, page, t, zoom]);

  if (error) {
    return <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{error}</div>;
  }

  if (loading && !numPages) {
    return <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{t('loading')}</div>;
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [blobUrl, setBlobUrl] = useState('');
  const blobUrlRef = useRef('');
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [rendered, setRendered] = useState(false);

  const finalSrc = useMemo(() => blobUrl || resolvedSrc || '', [blobUrl, resolvedSrc]);

  useEffect(() => {
    blobUrlRef.current = blobUrl;
  }, [blobUrl]);

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
    setPdfData(null);
    setZoom(1);
    setPage(1);
    setNumPages(0);
    setRendered(false);
    const prevBlobUrl = blobUrlRef.current;
    if (prevBlobUrl) {
      try {
        URL.revokeObjectURL(prevBlobUrl);
      } catch {
      }
      setBlobUrl('');
    }

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
        const nextUrl = URL.createObjectURL(blob);
        if (!alive) {
          try {
            URL.revokeObjectURL(nextUrl);
          } catch {
          }
          return;
        }
        setPdfData(nextData);
        setBlobUrl(nextUrl);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        const msg = e?.message ? String(e.message) : t('operationFailed');
        console.error('[PdfLightbox] fetch failed', e);
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
  }, [resolvedSrc, token, t]);

  useEffect(() => {
    return () => {
      const current = blobUrlRef.current;
      if (current) {
        try {
          URL.revokeObjectURL(current);
        } catch {
        }
      }
    };
  }, []);

  if (!resolvedSrc) return null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-zinc-900 sm:mx-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-xl sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/10"
              onClick={() => onClose?.()}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
          </div>

          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ‹
            </button>
            <div className="min-w-[4.25rem] text-center text-xs tabular-nums">
              {numPages ? `${page}/${numPages}` : '—'}
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(Math.max(1, numPages || 1), p + 1))}
              disabled={numPages ? page >= numPages : true}
            >
              ›
            </button>

            <div className="mx-1 h-5 w-px bg-white/10" />

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
              onClick={() => setZoom((z) => clamp(z - 0.25, 0.5, 4))}
            >
              −
            </button>
            <div className="min-w-[3.5rem] text-center text-xs tabular-nums">{`${Math.round(zoom * 100)}%`}</div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
              onClick={() => setZoom((z) => clamp(z + 0.25, 0.5, 4))}
            >
              +
            </button>

            <div className="mx-1 h-5 w-px bg-white/10" />

            <a
              href={finalSrc}
              target="_blank"
              rel="noreferrer"
              className="rounded px-2 py-1 text-xs font-semibold hover:bg-white/10"
            >
              {t('openInNewTab')}
            </a>
            <a href={finalSrc} download className="rounded px-2 py-1 text-xs font-semibold hover:bg-white/10">
              Download
            </a>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-white">
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
          ) : loading && !pdfData ? (
            <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{t('loading')}</div>
          ) : pdfData instanceof Uint8Array ? (
            <PdfCanvasViewer
              data={pdfData}
              page={page}
              zoom={zoom}
              onNumPagesChange={(n) => {
                const total = Number(n) || 0;
                setNumPages(total);
                setPage((p) => clamp(p, 1, Math.max(1, total)));
              }}
              onRenderStateChange={({ rendered: didRender, error: renderError }) => {
                setRendered(Boolean(didRender));
                if (renderError) setError(String(renderError));
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-sm text-zinc-700">{t('operationFailed')}</div>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
