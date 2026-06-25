import React, { useCallback, useEffect, useRef, useState } from 'react';
import { resolvePublicMediaUrl } from '../../utils/apiBase';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function snap(n, grid) {
  if (!grid) return n;
  return Math.round(n / grid) * grid;
}

export default function CanvasStage({
  width,
  height,
  scale = 1,
  mode = 'edit',
  backgroundMode = 'background',
  backgroundColor = '#ffffff',
  items,
  setItems,
  selectedId,
  setSelectedId,
  backgroundUrl,
  grid = 4,
  containerClassName = '',
  containerStyle,
  largeUi = false
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const itemsRef = useRef(items);
  const [activePointer, setActivePointer] = useState(false);
  const canSelect = mode === 'edit' || mode === 'select';
  const canTransform = mode === 'edit';
  const resolvedBackgroundUrl = backgroundUrl ? resolvePublicMediaUrl(backgroundUrl) : '';

  const applyUpdate = useCallback((updater) => {
    if (!canTransform) return;
    if (!setItems) return;
    const current = itemsRef.current || [];
    const next = typeof updater === 'function' ? updater(current) : updater;
    if (Object.is(next, current)) return;
    setItems(next);
  }, [canTransform, setItems]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!canTransform) return;
    if (!setItems) return;
    applyUpdate((prev) => {
      if (!Array.isArray(prev)) return prev;
      const minW = 24;
      const minH = 20;
      let changed = false;
      const next = prev.map((it) => {
        if (!it) return it;
        const nx = clamp(snap(Number(it.x) || 0, grid), 0, Math.max(0, width - minW));
        const ny = clamp(snap(Number(it.y) || 0, grid), 0, Math.max(0, height - minH));
        const nw = clamp(snap(Number(it.w) || minW, grid), minW, Math.max(minW, width - nx));
        const nh = clamp(snap(Number(it.h) || minH, grid), minH, Math.max(minH, height - ny));
        if (nx !== it.x || ny !== it.y || nw !== it.w || nh !== it.h) changed = true;
        return nx === it.x && ny === it.y && nw === it.w && nh === it.h ? it : { ...it, x: nx, y: ny, w: nw, h: nh };
      });
      return changed ? next : prev;
    });
  }, [applyUpdate, grid, height, canTransform, setItems, width]);

  useEffect(() => {
    if (!canTransform) return undefined;
    if (!setItems) return undefined;
    const onKeyDown = (e) => {
      if (!selectedId) return;
      const t = e.target;
      const tag = String(t?.tagName || '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || Boolean(t?.isContentEditable);
      if (editable) return;
      if (e.key === 'Escape') {
        if (setSelectedId) setSelectedId(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        applyUpdate((prev) => (Array.isArray(prev) ? prev.filter((it) => it.id !== selectedId) : prev));
        if (setSelectedId) setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyUpdate, canTransform, selectedId, setItems, setSelectedId]);

  useEffect(() => {
    if (!canTransform) return undefined;
    if (!activePointer) return;

    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      applyUpdate((prev) =>
        prev.map((it) => {
          if (it.id !== d.id) return it;

          if (d.kind === 'drag') {
            const nx = clamp(snap(x - d.offsetX, grid), 0, width - it.w);
            const ny = clamp(snap(y - d.offsetY, grid), 0, height - it.h);
            return { ...it, x: nx, y: ny };
          }

          const minW = 24;
          const minH = 20;
          const nw = clamp(snap(d.startW + (x - d.startX), grid), minW, width - it.x);
          const nh = clamp(snap(d.startH + (y - d.startY), grid), minH, height - it.y);
          return { ...it, w: nw, h: nh };
        })
      );
    };

    const onUp = () => {
      dragRef.current = null;
      setActivePointer(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [activePointer, applyUpdate, grid, height, canTransform, scale, width]);

  const onItemPointerDown = (e, item, kind) => {
    if (!canSelect) return;
    if (canTransform) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (setSelectedId) setSelectedId(item.id);

    if (!canTransform) return;

    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (kind === 'resize') {
      dragRef.current = {
        kind: 'resize',
        id: item.id,
        startX: x,
        startY: y,
        startW: item.w,
        startH: item.h
      };
    } else {
      dragRef.current = {
        kind: 'drag',
        id: item.id,
        offsetX: x - item.x,
        offsetY: y - item.y
      };
    }

    setActivePointer(true);
  };

  return (
    <div className={`w-full overflow-auto p-3 ${containerClassName}`} style={containerStyle}>
      <div className="mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          ref={stageRef}
          className="relative rounded-xl border border-zinc-200 shadow-sm"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', backgroundColor: String(backgroundColor || '#ffffff') }}
          onPointerDown={() => {
            if (!canSelect) return;
            if (setSelectedId) setSelectedId(null);
          }}
        >
          {backgroundUrl ? (
            /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(resolvedBackgroundUrl || '')) ? (
              <video
                src={resolvedBackgroundUrl}
                className={
                  backgroundMode === 'actual'
                    ? 'absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 rounded-xl object-center'
                    : backgroundMode === 'fit'
                      ? 'absolute inset-0 h-full w-full rounded-xl object-contain object-center'
                    : 'absolute inset-0 h-full w-full rounded-xl object-fill object-center'
                }
                muted
                playsInline
                autoPlay
                loop
              />
            ) : (
              <img
                src={resolvedBackgroundUrl}
                alt="Background"
                className={
                  backgroundMode === 'actual'
                    ? 'absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 rounded-xl object-center'
                    : backgroundMode === 'fit'
                      ? 'absolute inset-0 h-full w-full rounded-xl object-contain object-center'
                      : 'absolute inset-0 h-full w-full rounded-xl object-fill object-center'
                }
                loading="eager"
                decoding="async"
                fetchPriority="high"
                draggable={false}
              />
            )
          ) : null}

          {(Array.isArray(items) ? items : []).map((raw, idx) => {
            const it = raw && typeof raw === 'object' ? raw : {};
            const key = it.id != null ? it.id : `item-${idx}`;
            const selected = canSelect && it.id === selectedId;
            const resizeHandleClass = largeUi
              ? 'absolute -bottom-3 -right-3 h-6 w-6 rounded bg-brand-600 cursor-nwse-resize'
              : 'absolute -bottom-1 -right-1 h-3 w-3 rounded bg-brand-600 cursor-nwse-resize';
            return (
              <div
                key={key}
                className={`absolute rounded-lg ${
                  canSelect
                    ? selected
                      ? 'ring-1 ring-brand-500 bg-white/50'
                      : 'ring-1 ring-zinc-200/60 bg-white/40'
                    : 'pointer-events-none'
                }`}
                style={{ left: it.x, top: it.y, width: it.w, height: it.h }}
                onPointerDown={(e) => onItemPointerDown(e, it, 'drag')}
              >
                <div className="h-full w-full overflow-hidden rounded-lg">
                  {typeof it.render === 'function' ? it.render(it) : null}
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  className={`${resizeHandleClass} ${canTransform && selected ? '' : 'hidden'}`}
                  onPointerDown={(e) => onItemPointerDown(e, it, 'resize')}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
