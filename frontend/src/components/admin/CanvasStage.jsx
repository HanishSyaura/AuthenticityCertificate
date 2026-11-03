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
  selectedIds = [],
  setSelectedIds,
  enableMultiSelect = false,
  backgroundUrl,
  grid = 4,
  containerClassName = '',
  containerStyle,
  largeUi = false,
  scrollable = true
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
        // Clamp only; preserve 1px keyboard movement.
        // Pointer drag/resize handlers still apply grid snapping.
        const nx = clamp(Number(it.x) || 0, 0, Math.max(0, width - minW));
        const ny = clamp(Number(it.y) || 0, 0, Math.max(0, height - minH));
        const nw = clamp(Number(it.w) || minW, minW, Math.max(minW, width - nx));
        const nh = clamp(Number(it.h) || minH, minH, Math.max(minH, height - ny));
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
      const activeIds = enableMultiSelect && Array.isArray(selectedIds) && selectedIds.length
        ? selectedIds
        : (selectedId ? [selectedId] : []);
      if (!activeIds.length) return;
      const t = e.target;
      const tag = String(t?.tagName || '').toLowerCase();
      const insideStage = Boolean(stageRef.current?.contains(t));
      const editable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(t?.isContentEditable) ||
        Boolean(t?.closest?.('input, textarea, select, [contenteditable="true"]')) ||
        (Boolean(t?.closest?.('button')) && !insideStage);
      if (editable) return;

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;

        applyUpdate((prev) => {
          if (!Array.isArray(prev)) return prev;

          let changed = false;
          const next = prev.map((it) => {
            if (!activeIds.includes(it?.id)) return it;

            const itemW = Number(it.w) || 24;
            const itemH = Number(it.h) || 20;
            let x = Number(it.x) || 0;
            let y = Number(it.y) || 0;

            if (e.key === 'ArrowLeft') x -= step;
            if (e.key === 'ArrowRight') x += step;
            if (e.key === 'ArrowUp') y -= step;
            if (e.key === 'ArrowDown') y += step;

            x = clamp(x, 0, Math.max(0, width - itemW));
            y = clamp(y, 0, Math.max(0, height - itemH));

            if (x === it.x && y === it.y) return it;
            changed = true;
            return { ...it, x, y };
          });

          return changed ? next : prev;
        });
        return;
      }

      if (e.key === 'Escape') {
        if (setSelectedIds) setSelectedIds([]);
        if (setSelectedId) setSelectedId(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        applyUpdate((prev) => (Array.isArray(prev) ? prev.filter((it) => !activeIds.includes(it.id)) : prev));
        if (setSelectedIds) setSelectedIds([]);
        if (setSelectedId) setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyUpdate, canTransform, selectedId, selectedIds, enableMultiSelect, setItems, setSelectedId, setSelectedIds]);

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
          if (d.kind === 'drag' ? !d.ids?.includes(it.id) : it.id !== d.id) return it;

          if (d.kind === 'drag') {
            if (!d.ids?.includes(it.id)) return it;
            const origin = d.origins?.[it.id];
            if (!origin) return it;
            const dx = clamp(
              snap(x - d.startX, grid),
              -d.minX,
              width - d.maxRight
            );
            const dy = clamp(
              snap(y - d.startY, grid),
              -d.minY,
              height - d.maxBottom
            );
            return { ...it, x: origin.x + dx, y: origin.y + dy };
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
    if (canTransform) stageRef.current?.focus({ preventScroll: true });
    const multiKey = enableMultiSelect && (e.ctrlKey || e.metaKey);
    const currentIds = Array.isArray(selectedIds) ? selectedIds : [];

    if (multiKey && kind === 'drag' && setSelectedIds) {
      const nextIds = currentIds.includes(item.id)
        ? currentIds.filter((id) => id !== item.id)
        : [...currentIds, item.id];
      setSelectedIds(nextIds);
      setSelectedId(nextIds.length ? nextIds[nextIds.length - 1] : null);
      return;
    }

    const preserveMulti = enableMultiSelect && kind === 'drag' && currentIds.includes(item.id);
    const itemGroupId = item.groupId;
    const groupMemberIds = enableMultiSelect && itemGroupId
      ? (itemsRef.current || [])
          .filter((it) => it?.groupId === itemGroupId)
          .map((it) => it.id)
      : [item.id];

    if (!preserveMulti && setSelectedIds) setSelectedIds(groupMemberIds);
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
      const movingIds = preserveMulti ? currentIds : [item.id];
      const movingItems = (itemsRef.current || []).filter((it) => movingIds.includes(it?.id));
      const origins = Object.fromEntries(movingItems.map((it) => [
        it.id,
        { x: Number(it.x) || 0, y: Number(it.y) || 0 }
      ]));
      const minX = Math.min(...movingItems.map((it) => origins[it.id].x));
      const minY = Math.min(...movingItems.map((it) => origins[it.id].y));
      const maxRight = Math.max(...movingItems.map((it) => origins[it.id].x + (Number(it.w) || 24)));
      const maxBottom = Math.max(...movingItems.map((it) => origins[it.id].y + (Number(it.h) || 20)));
      dragRef.current = {
        kind: 'drag',
        id: item.id,
        ids: movingIds,
        origins,
        startX: x,
        startY: y,
        minX,
        minY,
        maxRight,
        maxBottom
      };
    }

    setActivePointer(true);
  };

  return (
    <div
      className={`${scrollable ? 'w-full overflow-auto p-3' : 'flex h-full w-full items-center justify-center overflow-hidden p-3'} ${containerClassName}`}
      style={containerStyle}
    >
      <div className="mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          ref={stageRef}
          tabIndex={canTransform ? 0 : undefined}
          className="relative rounded-xl border border-zinc-200 shadow-sm focus:outline-none"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', backgroundColor: String(backgroundColor || '#ffffff') }}
          onPointerDown={() => {
            if (!canSelect) return;
            if (setSelectedIds) setSelectedIds([]);
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
                fetchpriority="high"
                draggable={false}
              />
            )
          ) : null}

          {(Array.isArray(items) ? items : []).map((raw, idx) => {
            const it = raw && typeof raw === 'object' ? raw : {};
            const key = it.id != null ? it.id : `item-${idx}`;
            const selected = canSelect && (
              it.id === selectedId ||
              (enableMultiSelect && Array.isArray(selectedIds) && selectedIds.includes(it.id))
            );
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
