import React, { useEffect, useMemo, useState } from 'react';
import { resolvePublicMediaUrl } from '../utils/apiBase';
import { useT } from '../i18n/useT';
import useAdminAuthStore from '../store/useAdminAuthStore';

const cache = new Map();

async function renderFirstPagePngDataUrl({ arrayBuffer, widthPx }) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buf = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : new ArrayBuffer(0);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableWorker: true }).promise;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const targetW = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 520;
  const scale = Math.max(0.1, targetW / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas not supported');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const out = canvas.toDataURL('image/png');
  try {
    page.cleanup();
    doc.cleanup?.();
    doc.destroy?.();
  } catch {
  }
  return out;
}

export default function PdfFirstPageThumb({ src, title = 'PDF', className = '', style, fit = 'cover', silent = true }) {
  const { t } = useT();
  const token = useAdminAuthStore((s) => s.token);
  const resolvedSrc = useMemo(() => resolvePublicMediaUrl(src), [src]);
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setError('');
    setDataUrl('');
    if (!resolvedSrc) return () => void 0;

    const cacheKey = `${resolvedSrc}|auth:${token ? '1' : '0'}`;
    const cached = cache.get(cacheKey);
    if (cached && typeof cached === 'object') {
      if (cached.dataUrl) setDataUrl(cached.dataUrl);
      if (cached.error) setError(cached.error);
      return () => void 0;
    }

    setLoading(true);
    const run = async () => {
      try {
        const res = await fetch(resolvedSrc, {
          signal: ctrl.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const buf = await res.arrayBuffer();
        const out = await renderFirstPagePngDataUrl({ arrayBuffer: buf, widthPx: 520 });
        cache.set(cacheKey, { dataUrl: out, error: '' });
        if (!alive) return;
        setDataUrl(out);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        const msg = e?.message ? String(e.message) : t('operationFailed');
        cache.set(cacheKey, { dataUrl: '', error: msg });
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

  if (!resolvedSrc) {
    return <div style={style} className={`h-full w-full ${className}`} />;
  }

  if (dataUrl) {
    const objectFit = fit === 'contain' ? 'object-contain' : 'object-cover';
    return <img src={dataUrl} alt={title} style={style} className={`block h-full w-full ${objectFit} ${className}`} draggable={false} />;
  }

  if (silent) {
    return <div style={style} className={`h-full w-full ${className}`} />;
  }

  return (
    <div style={style} className={`flex items-center justify-center rounded-lg border border-zinc-200 bg-white/60 text-[11px] text-zinc-600 ${className}`}>
      {loading ? t('loading') : error || t('operationFailed')}
    </div>
  );
}
