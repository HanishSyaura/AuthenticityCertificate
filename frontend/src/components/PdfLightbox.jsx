import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/useT';
import { resolvePublicMediaUrl } from '../utils/apiBase';
import useAdminAuthStore from '../store/useAdminAuthStore';

let workerSrcPromise = null;
let workerSrcBlobUrl = '';

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

function PdfCanvasViewer({ data, title, zoom = 1 }) {
  const { t } = useT();
  const containerRef = useRef(null);
  const docRef = useRef(null);
  const canvasByPageRef = useRef(new Map());
  const renderSeqRef = useRef(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = Number(el.clientWidth || 0);
      setContainerW(Number.isFinite(w) && w > 0 ? w : 0);
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    let alive = true;
    setError('');
    setNumPages(0);
    const prevDoc = docRef.current;
    docRef.current = null;
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
          doc = await pdfjs.getDocument({ data }).promise;
        } catch {
          doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
        }
        if (!alive) {
          try {
            doc.destroy?.();
          } catch {
          }
          return;
        }
        docRef.current = doc;
        setNumPages(Number(doc?.numPages) > 0 ? Number(doc.numPages) : 0);
      } catch (e) {
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
    if (!containerW) return () => void 0;
    const doc = docRef.current;
    if (!doc) return () => void 0;
    const seq = (renderSeqRef.current += 1);
    const getCanvasEl = (pageNum) => {
      const fromMap = canvasByPageRef.current.get(pageNum) || null;
      if (fromMap instanceof HTMLCanvasElement) return fromMap;
      const root = containerRef.current;
      if (!root) return null;
      const sel = `[data-ac-pdf-page="${pageNum}"]`;
      const el = root.querySelector(sel);
      return el instanceof HTMLCanvasElement ? el : null;
    };

    const run = async () => {
      try {
        await new Promise((r) => window.requestAnimationFrame(r));

        for (let pageNum = 1; pageNum <= numPages; pageNum += 1) {
          if (!alive) break;
          if (seq !== renderSeqRef.current) break;
          const canvas = getCanvasEl(pageNum);
          if (!(canvas instanceof HTMLCanvasElement)) continue;
          const page = await doc.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const targetW = Math.max(1, Math.floor(containerW));
          const fitScale = Math.max(0.1, targetW / Math.max(1, baseViewport.width));
          const scale = Math.max(0.1, fitScale * Math.max(0.25, Math.min(6, Number(zoom) || 1)));
          const viewport = page.getViewport({ scale });

          const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.max(1, Number(window.devicePixelRatio) || 1) : 1;
          const cssW = Math.max(1, Math.floor(viewport.width));
          const cssH = Math.max(1, Math.floor(viewport.height));
          canvas.width = Math.max(1, Math.floor(cssW * dpr));
          canvas.height = Math.max(1, Math.floor(cssH * dpr));
          canvas.style.width = `${cssW}px`;
          canvas.style.height = `${cssH}px`;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) continue;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const task = page.render({ canvasContext: ctx, viewport });
          await task.promise;
          try {
            page.cleanup();
          } catch {
          }
        }
      } catch (e) {
        const msg = e?.message ? String(e.message) : t('operationFailed');
        if (!alive) return;
        setError(msg);
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [containerW, data, numPages, t, zoom]);

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
      <div className="mx-auto w-full max-w-none px-0 py-4 sm:max-w-[980px] sm:px-6 sm:py-6">
        <div className="text-xs font-semibold text-zinc-600">{title || 'PDF'}</div>
        <div className="mt-3 space-y-4">
          {Array.from({ length: numPages }).map((_, idx) => {
            const n = idx + 1;
            return (
              <div key={n} className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm shadow-zinc-900/5">
                <canvas
                  className="block h-auto w-full"
                  data-ac-pdf-page={n}
                  ref={(el) => {
                    if (el) canvasByPageRef.current.set(n, el);
                    else canvasByPageRef.current.delete(n);
                  }}
                />
              </div>
            );
          })}
        </div>
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

  const iframeSrc = useMemo(() => blobUrl || '', [blobUrl]);
  const preferCanvas = useMemo(() => {
    try {
      if (typeof navigator === 'undefined') return false;
      const ua = String(navigator.userAgent || '');
      return /Android/i.test(ua);
    } catch {
      return false;
    }
  }, []);
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
    <div className="fixed inset-0 z-[9999] bg-black/70 sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex h-full w-full flex-col sm:mx-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-black/80 px-3 py-3 text-white backdrop-blur sm:rounded-t-xl sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
          <button type="button" aria-label="Close" className="rounded bg-black/50 px-3 py-1 text-sm text-white" onClick={() => onClose?.()}>
            ×
          </button>
          <div className="min-w-0 flex-1 truncate text-center text-sm font-semibold sm:text-left">{title}</div>
          {preferCanvas ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded bg-black/50 px-2 py-1 text-xs font-semibold text-white"
                onClick={() => setZoom((z) => Math.max(0.5, Number(z || 1) - 0.25))}
              >
                −
              </button>
              <button
                type="button"
                className="rounded bg-black/50 px-2 py-1 text-[11px] font-semibold text-white"
                onClick={() => setZoom(1)}
              >
                {Math.round((Number(zoom) || 1) * 100)}%
              </button>
              <button
                type="button"
                className="rounded bg-black/50 px-2 py-1 text-xs font-semibold text-white"
                onClick={() => setZoom((z) => Math.min(4, Number(z || 1) + 0.25))}
              >
                +
              </button>
            </div>
          ) : null}
          <a href={iframeSrc || resolvedSrc} target="_blank" rel="noreferrer" className="text-xs font-semibold text-white underline">
            {t('openInNewTab')}
          </a>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-white sm:rounded-xl">
          {preferCanvas && pdfData instanceof Uint8Array ? (
            <PdfCanvasViewer data={pdfData} title={title} zoom={zoom} />
          ) : iframeSrc ? (
            <iframe title={title} src={iframeSrc} className="h-full w-full bg-white" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded bg-white p-4 text-sm text-zinc-700">
              {loading ? t('loading') : error || t('operationFailed')}
            </div>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
