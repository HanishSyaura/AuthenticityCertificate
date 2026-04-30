import React, { useCallback, useEffect, useRef, useState } from 'react';

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
  backgroundMode = 'background',
  backgroundColor = '#ffffff',
  items,
  setItems,
  selectedId,
  setSelectedId,
  backgroundUrl,
  grid = 4
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const itemsRef = useRef(items);
  const [activePointer, setActivePointer] = useState(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const applyUpdate = useCallback((updater) => {
    const current = itemsRef.current || [];
    const next = typeof updater === 'function' ? updater(current) : updater;
    setItems(next);
  }, [setItems]);

  useEffect(() => {
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
            const nx = snap(clamp(x - d.offsetX, 0, width - it.w), grid);
            const ny = snap(clamp(y - d.offsetY, 0, height - it.h), grid);
            return { ...it, x: nx, y: ny };
          }

          const minW = 40;
          const minH = 30;
          const nw = snap(clamp(d.startW + (x - d.startX), minW, width - it.x), grid);
          const nh = snap(clamp(d.startH + (y - d.startY), minH, height - it.y), grid);
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
  }, [activePointer, applyUpdate, grid, height, width]);

  const onItemPointerDown = (e, item, kind) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(item.id);

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
    <div className="w-full overflow-auto p-3">
      <div className="mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          ref={stageRef}
          className="relative rounded-xl border border-zinc-200 shadow-sm"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', backgroundColor: String(backgroundColor || '#ffffff') }}
          onPointerDown={() => setSelectedId(null)}
        >
          {backgroundUrl ? (
            /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(backgroundUrl || '')) ? (
              <video
                src={backgroundUrl}
                className={
                  backgroundMode === 'actual'
                    ? 'absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 rounded-xl object-center'
                    : 'absolute inset-0 h-full w-full rounded-xl object-fill object-center'
                }
                muted
                playsInline
                autoPlay
                loop
              />
            ) : (
              <img
                src={backgroundUrl}
                alt="Background"
                className={
                  backgroundMode === 'actual'
                    ? 'absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 rounded-xl object-center'
                    : 'absolute inset-0 h-full w-full rounded-xl object-fill object-center'
                }
                draggable={false}
              />
            )
          ) : null}

          {items.map((it) => {
            const selected = it.id === selectedId;
            return (
              <div
                key={it.id}
                className={`absolute rounded-lg ${selected ? 'ring-2 ring-brand-500' : 'ring-1 ring-zinc-200/80'} bg-white/70 backdrop-blur-sm`}
                style={{ left: it.x, top: it.y, width: it.w, height: it.h }}
                onPointerDown={(e) => onItemPointerDown(e, it, 'drag')}
              >
                <div className="h-full w-full overflow-hidden rounded-lg">
                  {it.render ? it.render(it) : null}
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  className={`absolute -bottom-2 -right-2 h-4 w-4 rounded bg-brand-600 ${selected ? '' : 'hidden'}`}
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
