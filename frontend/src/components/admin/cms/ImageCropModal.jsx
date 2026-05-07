import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n/useT';
import { cropImageToBlob } from '../../../utils/cropImage';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRect(a, b) {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x, b.x);
  const y2 = Math.max(a.y, b.y);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

function extForMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function withCropSuffix(name, mime) {
  const base = String(name || 'image').replace(/\.[^/.]+$/, '');
  const ext = extForMime(mime);
  return `${base}-crop.${ext}`;
}

export default function ImageCropModal({ open, file, onClose, onConfirm, onUseOriginal }) {
  const { t } = useT();
  const imgRef = useRef(null);
  const pointerRef = useRef(null);

  const [src, setSrc] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [sel, setSel] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });

  useEffect(() => {
    if (!open || !file) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setReady(false);
    setError(null);
    return () => {
      URL.revokeObjectURL(url);
      setSrc('');
    };
  }, [file, open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, onClose, open]);

  const img = imgRef.current;
  const imgMeta = img ? { nw: Number(img.naturalWidth) || 0, nh: Number(img.naturalHeight) || 0 } : { nw: 0, nh: 0 };

  const getRelPoint = useCallback((e) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0, rect: null };
    const r = img.getBoundingClientRect();
    const x = r.width > 0 ? (e.clientX - r.left) / r.width : 0;
    const y = r.height > 0 ? (e.clientY - r.top) / r.height : 0;
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1), rect: r };
  }, []);

  const minRelSize = useCallback((rect) => {
    const w = rect?.width || 0;
    const h = rect?.height || 0;
    const minPx = 24;
    return { mw: w > 0 ? minPx / w : 0.02, mh: h > 0 ? minPx / h : 0.02 };
  }, []);

  const startPointer = useCallback(
    (e, mode, handle) => {
      if (!ready || busy) return;
      const { x, y, rect } = getRelPoint(e);
      const { mw, mh } = minRelSize(rect);
      pointerRef.current = {
        id: e.pointerId,
        mode,
        handle,
        start: { x, y },
        startSel: sel,
        mw,
        mh
      };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      if (mode === 'new') setSel({ x, y, w: mw, h: mh });
    },
    [busy, getRelPoint, minRelSize, ready, sel]
  );

  const onPointerMove = useCallback(
    (e) => {
      const st = pointerRef.current;
      if (!st || st.id !== e.pointerId) return;
      const { x, y } = getRelPoint(e);
      const dx = x - st.start.x;
      const dy = y - st.start.y;

      if (st.mode === 'move') {
        const nx = clamp(st.startSel.x + dx, 0, 1 - st.startSel.w);
        const ny = clamp(st.startSel.y + dy, 0, 1 - st.startSel.h);
        setSel((prev) => ({ ...prev, x: nx, y: ny }));
        return;
      }

      if (st.mode === 'new') {
        const rect = normalizeRect(st.start, { x, y });
        const w = clamp(rect.w, st.mw, 1);
        const h = clamp(rect.h, st.mh, 1);
        const nx = clamp(rect.x, 0, 1 - w);
        const ny = clamp(rect.y, 0, 1 - h);
        setSel({ x: nx, y: ny, w, h });
        return;
      }

      if (st.mode === 'resize') {
        const s = st.startSel;
        let x1 = s.x;
        let y1 = s.y;
        let x2 = s.x + s.w;
        let y2 = s.y + s.h;

        if (st.handle === 'nw') {
          x1 = clamp(s.x + dx, 0, x2 - st.mw);
          y1 = clamp(s.y + dy, 0, y2 - st.mh);
        }
        if (st.handle === 'ne') {
          x2 = clamp(s.x + s.w + dx, x1 + st.mw, 1);
          y1 = clamp(s.y + dy, 0, y2 - st.mh);
        }
        if (st.handle === 'sw') {
          x1 = clamp(s.x + dx, 0, x2 - st.mw);
          y2 = clamp(s.y + s.h + dy, y1 + st.mh, 1);
        }
        if (st.handle === 'se') {
          x2 = clamp(s.x + s.w + dx, x1 + st.mw, 1);
          y2 = clamp(s.y + s.h + dy, y1 + st.mh, 1);
        }

        const w = clamp(x2 - x1, st.mw, 1);
        const h = clamp(y2 - y1, st.mh, 1);
        setSel({ x: x1, y: y1, w, h });
      }
    },
    [getRelPoint]
  );

  const onPointerUp = useCallback((e) => {
    const st = pointerRef.current;
    if (!st || st.id !== e.pointerId) return;
    pointerRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  const cropStats = useMemo(() => {
    const nw = imgMeta.nw;
    const nh = imgMeta.nh;
    if (!nw || !nh) return { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: Math.round(sel.x * nw),
      y: Math.round(sel.y * nh),
      w: Math.max(1, Math.round(sel.w * nw)),
      h: Math.max(1, Math.round(sel.h * nh))
    };
  }, [imgMeta.nh, imgMeta.nw, sel.h, sel.w, sel.x, sel.y]);

  const handleConfirm = useCallback(async () => {
    if (!file || !ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const mime = file.type || 'image/jpeg';
      const blob = await cropImageToBlob(file, { x: cropStats.x, y: cropStats.y, width: cropStats.w, height: cropStats.h }, { mimeType: mime });
      const nextName = withCropSuffix(file.name, blob.type || mime);
      const out = new File([blob], nextName, { type: blob.type || mime, lastModified: Date.now() });
      await onConfirm?.(out);
    } catch (err) {
      setError(String(err?.message || t('cropFailed')));
    } finally {
      setBusy(false);
    }
  }, [busy, cropStats.h, cropStats.w, cropStats.x, cropStats.y, file, onConfirm, ready, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-900">{t('cropImage')}</div>
          <button
            type="button"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            disabled={busy}
            onClick={() => onClose?.()}
          >
            {t('close')}
          </button>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr,260px]">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-zinc-600">{t('cropHint')}</div>
              <div className="text-[11px] text-zinc-500">
                {cropStats.w}×{cropStats.h}px
              </div>
            </div>

            <div className="mt-3 flex justify-center">
              <div className="relative inline-block max-h-[70vh] max-w-full select-none">
                {src ? (
                  <img
                    ref={imgRef}
                    src={src}
                    alt=""
                    className="max-h-[70vh] max-w-full rounded-lg object-contain"
                    onLoad={() => {
                      setReady(true);
                      setSel({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
                    }}
                  />
                ) : (
                  <div className="h-[320px] w-[480px] rounded-lg bg-white" />
                )}

                <div
                  className="absolute inset-0"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => {
                    const handle = e.target?.dataset?.handle;
                    if (handle) {
                      startPointer(e, 'resize', String(handle));
                      return;
                    }
                    const role = e.target?.dataset?.role;
                    if (role === 'selection') startPointer(e, 'move', null);
                    else startPointer(e, 'new', null);
                  }}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <div className="absolute inset-0 rounded-lg">
                    <div
                      className="absolute left-0 right-0 top-0 bg-black/25"
                      style={{ height: `${sel.y * 100}%` }}
                    />
                    <div
                      className="absolute left-0 right-0 bg-black/25"
                      style={{ top: `${(sel.y + sel.h) * 100}%`, bottom: 0 }}
                    />
                    <div
                      className="absolute left-0 bg-black/25"
                      style={{ top: `${sel.y * 100}%`, bottom: `${(1 - (sel.y + sel.h)) * 100}%`, width: `${sel.x * 100}%` }}
                    />
                    <div
                      className="absolute right-0 bg-black/25"
                      style={{
                        top: `${sel.y * 100}%`,
                        bottom: `${(1 - (sel.y + sel.h)) * 100}%`,
                        left: `${(sel.x + sel.w) * 100}%`
                      }}
                    />
                  </div>

                  <div
                    data-role="selection"
                    className="absolute rounded border-2 border-white"
                    style={{
                      left: `${sel.x * 100}%`,
                      top: `${sel.y * 100}%`,
                      width: `${sel.w * 100}%`,
                      height: `${sel.h * 100}%`
                    }}
                  >
                    <div
                      data-handle="nw"
                      data-role="handle"
                      className="absolute -left-2 -top-2 h-4 w-4 rounded border border-zinc-200 bg-white"
                      style={{ touchAction: 'none' }}
                    />
                    <div
                      data-handle="ne"
                      data-role="handle"
                      className="absolute -right-2 -top-2 h-4 w-4 rounded border border-zinc-200 bg-white"
                      style={{ touchAction: 'none' }}
                    />
                    <div
                      data-handle="sw"
                      data-role="handle"
                      className="absolute -bottom-2 -left-2 h-4 w-4 rounded border border-zinc-200 bg-white"
                      style={{ touchAction: 'none' }}
                    />
                    <div
                      data-handle="se"
                      data-role="handle"
                      className="absolute -bottom-2 -right-2 h-4 w-4 rounded border border-zinc-200 bg-white"
                      style={{ touchAction: 'none' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {error ? <div className="mt-3 text-xs text-rose-700">{error}</div> : null}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-700">{t('actions')}</div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                disabled={!file || busy}
                onClick={async () => {
                  if (!file || busy) return;
                  setBusy(true);
                  setError(null);
                  try {
                    await onUseOriginal?.(file);
                  } catch (err) {
                    setError(String(err?.message || t('uploadFailed')));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('useOriginal')}
              </button>

              <button
                type="button"
                disabled={!ready || !file || busy}
                onClick={handleConfirm}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {busy ? t('processing') : t('cropAndUpload')}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => onClose?.()}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
            </div>

            <div className="mt-4 text-[11px] text-zinc-500">{t('cropTip')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
