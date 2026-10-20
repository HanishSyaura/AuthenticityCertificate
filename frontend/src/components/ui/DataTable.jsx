import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { useT } from '../../i18n/useT';
import { nextSortState } from '../../utils/tableSort';

function getAlignClass(align) {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

function getJustifyClass(align) {
  if (align === 'right') return 'justify-end';
  if (align === 'center') return 'justify-center';
  return 'justify-start';
}

function SortIndicator({ active }) {
  const isActive = active === 'asc' || active === 'desc';
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      style={{ color: isActive ? 'var(--ac-brand)' : undefined }}
      className={`shrink-0 transition ${
        isActive ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-50'
      }`}
    >
      {active === 'desc' ? (
        <path d="M10 4.5v11M6 11.5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M10 15.5v-11M6 8.5l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getColumnMinWidth(column, fallback) {
  return Math.max(64, Number(column?.minWidth) || fallback);
}

function getColumnMaxWidth(column, min) {
  return Math.max(min, Number(column?.maxWidth) || 480);
}

function getPreferredColumnWidth(column, defaultColumnWidth, savedWidth) {
  const fallbackMin = Math.max(72, defaultColumnWidth - 16);
  const min = getColumnMinWidth(column, fallbackMin);
  const max = getColumnMaxWidth(column, min);
  if (Number.isFinite(Number(savedWidth)) && Number(savedWidth) > 0) {
    return clamp(Number(savedWidth), min, max);
  }

  const declaredWidth = Number(column?.width);
  if (Number.isFinite(declaredWidth) && declaredWidth > 0) {
    // Keep the designer's preferred width, but bias it closer to the real minimum
    // so dense admin tables don't feel over-expanded by default.
    return clamp(Math.round((declaredWidth + min) / 2), min, max);
  }

  return clamp(defaultColumnWidth, min, max);
}

function readPrefs(key) {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePrefs(key, value) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    void 0;
  }
}

function normalizeOrder(columnIds, savedOrder) {
  const base = Array.isArray(savedOrder) ? savedOrder.filter((id) => columnIds.includes(id)) : [];
  const missing = columnIds.filter((id) => !base.includes(id));
  return [...base, ...missing];
}

function normalizeHidden(columnIds, savedHidden) {
  return Array.isArray(savedHidden) ? savedHidden.filter((id) => columnIds.includes(id)) : [];
}

function normalizePinned(columnIds, savedPinned) {
  return Array.isArray(savedPinned) ? savedPinned.filter((id) => columnIds.includes(id)) : [];
}

function ColumnVisibilityManager({ open, onClose, triggerRef, columns, hiddenIds, onToggleVisibility }) {
  const { t } = useT();
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth || 280;
    const popoverHeight = popover.offsetHeight || 0;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const maxLeft = viewportWidth - margin - popoverWidth;
    const left = clamp(triggerRect.right - popoverWidth, margin, maxLeft);

    const bottomTop = triggerRect.bottom + 10;
    const topTop = triggerRect.top - 10 - popoverHeight;
    const canOpenBottom = bottomTop + popoverHeight <= viewportHeight - margin;
    const maxTop = Math.max(margin, viewportHeight - margin - popoverHeight);
    const top = clamp(canOpenBottom ? bottomTop : topTop, margin, maxTop);

    setPosition({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, columns.length]);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      onClose?.();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    const handleWindow = () => updatePosition();

    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleWindow);
    window.addEventListener('scroll', handleWindow, true);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleWindow);
      window.removeEventListener('scroll', handleWindow, true);
    };
  }, [open, onClose, triggerRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: position.top, left: position.left }}
      className="z-40 w-[280px] rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_24px_52px_rgba(15,23,42,0.18)]"
    >
      <div className="max-h-[320px] overflow-y-auto">
        {columns.map((column) => {
          const checked = !hiddenIds.includes(column.id);
          return (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={column.hideable === false}
                onChange={() => onToggleVisibility?.(column.id)}
                className="h-4 w-4 rounded border-slate-300 text-[var(--ac-brand)]"
              />
              <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                {column.label || column.header || t('columns')}
              </span>
            </label>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

function SortableHeaderCell({
  column,
  align,
  isPinned,
  stickyLeft,
  toolsEnabled,
  defaultColumnWidth,
  onTogglePinned,
  onStartResize,
  onResetWidth,
  headerClassName,
  sortState,
  onSortChange
}) {
  const { t } = useT();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.id,
    disabled: !toolsEnabled || column.sortable === false || column.lockedPosition === 'left'
  });

  const sortingEnabled = typeof onSortChange === 'function' && column.sortable !== false;
  const activeSort = sortingEnabled && sortState?.columnId === column.id ? sortState.direction : null;

  const width = Number(column.width || defaultColumnWidth);
  const minWidth = getColumnMinWidth(column, Math.max(72, defaultColumnWidth - 16));
  const style = {
    ...column.headerStyle,
    width,
    minWidth,
    maxWidth: column.maxWidth,
    left: isPinned ? stickyLeft : undefined,
    boxShadow: isPinned ? '1px 0 0 rgba(148,163,184,0.18)' : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : isPinned ? 20 : undefined
  };

  return (
    <th
      ref={setNodeRef}
      scope="col"
      className={`whitespace-nowrap border-b border-slate-200 ${headerClassName} ${align} ${
        isPinned ? 'sticky bg-[#f8fafc]' : ''
      } ${isDragging ? 'shadow-[0_14px_28px_rgba(15,23,42,0.14)]' : ''} ${column.headerClassName || ''}`.trim()}
      style={style}
    >
      <div className="group/header flex items-center gap-1.5">
        {toolsEnabled && column.sortable !== false && column.lockedPosition !== 'left' ? (
          <button
            type="button"
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-slate-400 transition hover:border-slate-300 hover:bg-white hover:text-slate-700 ${
              isDragging ? 'border-slate-300 bg-white text-slate-700 opacity-100' : 'border-transparent opacity-0 group-hover/header:opacity-100 focus-visible:opacity-100'
            }`}
            aria-label={t('dragToReorder')}
            title={t('dragToReorder')}
            {...attributes}
            {...listeners}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M7 4h.01M7 10h.01M7 16h.01M13 4h.01M13 10h.01M13 16h.01" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}

        {sortingEnabled ? (
          <button
            type="button"
            className={`group/sort flex min-w-0 flex-1 items-center gap-1.5 ${getJustifyClass(column.align)} ${
              activeSort ? 'text-slate-900' : ''
            }`}
            aria-label={t('sortColumn')}
            title={t('sortColumn')}
            onClick={(event) => {
              event.stopPropagation();
              onSortChange(nextSortState(sortState, column.id));
            }}
          >
            <span className="min-w-0 truncate leading-5">{column.header}</span>
            <SortIndicator active={activeSort} />
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate leading-5">{column.header}</span>
        )}

        {toolsEnabled && column.pinnable !== false ? (
          <button
            type="button"
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              isPinned
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-transparent text-slate-400 opacity-0 group-hover/header:opacity-100 hover:border-slate-300 hover:bg-white hover:text-slate-700 focus-visible:opacity-100'
            }`}
            aria-label={isPinned ? t('unlockColumn') : t('lockColumn')}
            title={isPinned ? t('unlockColumn') : t('lockColumn')}
            onClick={() => onTogglePinned?.(column.id)}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M7.5 3.5h5l-.5 4 2.5 2.5v1h-4V16l-.5.5-.5-.5v-4.5h-4v-1L8 7.5l-.5-4Z" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}

        {toolsEnabled && column.resizable !== false ? (
          <button
            type="button"
            className="inline-flex h-5 w-2 shrink-0 cursor-col-resize items-center justify-center rounded-full text-slate-300 opacity-0 transition group-hover/header:opacity-100 hover:bg-slate-200 hover:text-slate-500 focus-visible:opacity-100"
            aria-label={t('width')}
            title={t('width')}
            onMouseDown={(event) => onStartResize?.(event, column)}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onResetWidth?.(column.id);
            }}
          >
            <span className="block h-4 w-px bg-current" />
          </button>
        ) : null}
      </div>
    </th>
  );
}

export default function DataTable({
  columns,
  rows,
  rowKey,
  loading,
  loadingContent,
  emptyContent,
  onRowClick,
  top,
  bottom,
  sortState,
  onSortChange,
  density,
  minWidth,
  containerClassName,
  viewportClassName,
  tableClassName,
  columnTools
}) {
  const { t } = useT();
  const safeColumns = Array.isArray(columns) ? columns.filter((column) => column && column.id) : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const keyFn = typeof rowKey === 'function' ? rowKey : (row) => row?.id;
  const clickable = typeof onRowClick === 'function';
  const isCompact = String(density || '') === 'compact';
  const thClass = `${isCompact ? 'px-2.5 py-2.5' : 'px-3 py-3'} text-[12.75px] font-semibold text-slate-600`;
  const tdClass = `${isCompact ? 'px-2.5 py-2.5' : 'px-3 py-3'} text-[13px] text-slate-800`;
  const loadingCellClass = `${isCompact ? 'px-3 py-8' : 'px-4 py-10'} text-sm text-slate-600`;
  const emptyCellClass = `${isCompact ? 'px-3 py-12' : 'px-4 py-14'} text-center text-sm text-slate-600`;
  const toolsEnabled = Boolean(columnTools?.enabled && safeColumns.length);
  const storageKey = columnTools?.storageKey || '';
  const defaultColumnWidth = Math.max(72, Number(columnTools?.defaultColumnWidth) || 116);
  const columnIds = useMemo(() => safeColumns.map((column) => String(column.id)), [safeColumns]);
  const columnIdsKey = useMemo(() => columnIds.join('|'), [columnIds]);
  const initialPinnedIdsKey = useMemo(() => JSON.stringify(columnTools?.initialPinnedIds || []), [columnTools?.initialPinnedIds]);
  const lockedLeftIds = useMemo(
    () => safeColumns.filter((column) => column.lockedPosition === 'left').map((column) => String(column.id)),
    [safeColumns]
  );
  const triggerRef = useRef(null);
  const resizeRef = useRef(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [prefs, setPrefs] = useState(() => {
    const saved = readPrefs(storageKey);
    return {
      order: normalizeOrder(columnIds, saved?.order),
      hiddenIds: normalizeHidden(columnIds, saved?.hiddenIds),
      pinnedIds: normalizePinned(columnIds, saved?.pinnedIds || columnTools?.initialPinnedIds),
      widths: typeof saved?.widths === 'object' && saved?.widths ? saved.widths : {}
    };
  });

  useEffect(() => {
    const saved = readPrefs(storageKey);
    setPrefs({
      order: normalizeOrder(columnIds, saved?.order),
      hiddenIds: normalizeHidden(columnIds, saved?.hiddenIds),
      pinnedIds: normalizePinned(columnIds, saved?.pinnedIds || columnTools?.initialPinnedIds),
      widths: Object.fromEntries(
        Object.entries(typeof saved?.widths === 'object' && saved?.widths ? saved.widths : {}).filter(([key]) => columnIds.includes(key))
      )
    });
  }, [columnIdsKey, initialPinnedIdsKey, storageKey, toolsEnabled]);

  useEffect(() => {
    if (!toolsEnabled || !storageKey) return;
    writePrefs(storageKey, prefs);
  }, [toolsEnabled, storageKey, prefs]);

  useEffect(() => {
    const handleMove = (event) => {
      const state = resizeRef.current;
      if (!state) return;
      const column = safeColumns.find((item) => item.id === state.columnId);
      const min = getColumnMinWidth(column, Math.max(72, defaultColumnWidth - 16));
      const max = getColumnMaxWidth(column, min);
      const delta = event.clientX - state.startX;
      const nextWidth = clamp(state.startWidth + delta, min, max);
      setPrefs((prev) => ({ ...prev, widths: { ...prev.widths, [state.columnId]: nextWidth } }));
    };

    const handleUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [defaultColumnWidth, safeColumns]);

  const orderedColumns = useMemo(() => {
    const columnMap = new Map(safeColumns.map((column) => [String(column.id), column]));
    return prefs.order
      .map((id) => columnMap.get(id))
      .filter(Boolean)
      .map((column) => ({
        ...column,
        width: getPreferredColumnWidth(column, defaultColumnWidth, prefs.widths?.[column.id])
      }));
  }, [defaultColumnWidth, prefs.order, prefs.widths, safeColumns]);

  const visibleColumns = useMemo(() => {
    const visible = orderedColumns.filter((column) => !prefs.hiddenIds.includes(column.id) || lockedLeftIds.includes(String(column.id)));
    const lockedLeft = visible.filter((column) => lockedLeftIds.includes(String(column.id)));
    const pinned = visible.filter((column) => !lockedLeftIds.includes(String(column.id)) && prefs.pinnedIds.includes(column.id));
    const normal = visible.filter((column) => !lockedLeftIds.includes(String(column.id)) && !prefs.pinnedIds.includes(column.id));
    return [...lockedLeft, ...pinned, ...normal];
  }, [lockedLeftIds, orderedColumns, prefs.hiddenIds, prefs.pinnedIds]);

  const stickyLeftMap = useMemo(() => {
    let offset = 0;
    const map = new Map();
    visibleColumns.forEach((column) => {
      if (!lockedLeftIds.includes(String(column.id)) && !prefs.pinnedIds.includes(column.id)) return;
      map.set(column.id, offset);
      offset += Number(column.width || defaultColumnWidth);
    });
    return map;
  }, [defaultColumnWidth, lockedLeftIds, prefs.pinnedIds, visibleColumns]);

  const resolvedMinWidth = useMemo(() => {
    if (minWidth) return minWidth;
    return visibleColumns.reduce((sum, column) => sum + Number(column.width || defaultColumnWidth), 0);
  }, [defaultColumnWidth, minWidth, visibleColumns]);

  function updatePrefs(updater) {
    setPrefs((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }

  function toggleVisibility(columnId) {
    if (lockedLeftIds.includes(String(columnId))) return;
    updatePrefs((prev) => {
      const hidden = prev.hiddenIds.includes(columnId);
      return {
        ...prev,
        hiddenIds: hidden ? prev.hiddenIds.filter((id) => id !== columnId) : [...prev.hiddenIds, columnId],
        pinnedIds: hidden ? prev.pinnedIds : prev.pinnedIds.filter((id) => id !== columnId)
      };
    });
  }

  function togglePinned(columnId) {
    if (lockedLeftIds.includes(String(columnId))) return;
    updatePrefs((prev) => {
      const pinned = prev.pinnedIds.includes(columnId);
      return {
        ...prev,
        pinnedIds: pinned ? prev.pinnedIds.filter((id) => id !== columnId) : [...prev.pinnedIds, columnId]
      };
    });
  }

  function reorderColumns(activeId, overId) {
    if (lockedLeftIds.includes(String(activeId)) || lockedLeftIds.includes(String(overId))) return;
    updatePrefs((prev) => {
      const oldIndex = prev.order.indexOf(activeId);
      const newIndex = prev.order.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      return { ...prev, order: arrayMove(prev.order, oldIndex, newIndex) };
    });
  }

  function resetWidth(columnId) {
    updatePrefs((prev) => {
      const nextWidths = { ...prev.widths };
      delete nextWidths[columnId];
      return { ...prev, widths: nextWidths };
    });
  }

  function startResize(event, column) {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      columnId: column.id,
      startX: event.clientX,
      startWidth: Number(column.width || defaultColumnWidth)
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return (
    <div className={`ac-table overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)] ${containerClassName || ''}`.trim()}>
      {top || toolsEnabled ? (
        <div className="relative border-b border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{top}</div>
            {toolsEnabled ? (
              <div className="relative">
                <button
                  ref={triggerRef}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => setManagerOpen((value) => !value)}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 5.5h12M4 10h12M4 14.5h12" />
                  </svg>
                  {t('columns')}
                </button>
                <ColumnVisibilityManager
                  open={managerOpen}
                  onClose={() => setManagerOpen(false)}
                  triggerRef={triggerRef}
                  columns={orderedColumns}
                  hiddenIds={prefs.hiddenIds}
                  onToggleVisibility={toggleVisibility}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`overflow-x-auto ${viewportClassName || ''}`.trim()}>
        <div style={{ minWidth: resolvedMinWidth }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (!active?.id || !over?.id || active.id === over.id) return;
              reorderColumns(String(active.id), String(over.id));
            }}
          >
            <table className={`min-w-full border-separate border-spacing-0 text-sm ${tableClassName || ''}`.trim()}>
              <thead className="bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
                <SortableContext items={visibleColumns.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
                  <tr>
                    {visibleColumns.map((column) => {
                      const align = getAlignClass(column.align);
                      const stickyLeft = stickyLeftMap.get(column.id);
                      const isPinned = stickyLeftMap.has(column.id);
                      return (
                        <SortableHeaderCell
                          key={column.id}
                          column={column}
                          align={align}
                          isPinned={isPinned}
                          stickyLeft={stickyLeft}
                          toolsEnabled={toolsEnabled}
                          defaultColumnWidth={defaultColumnWidth}
                          onTogglePinned={togglePinned}
                          onStartResize={startResize}
                          onResetWidth={resetWidth}
                          headerClassName={thClass}
                          sortState={sortState}
                          onSortChange={onSortChange}
                        />
                      );
                    })}
                  </tr>
                </SortableContext>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={visibleColumns.length || 1} className={loadingCellClass}>
                      {loadingContent || t('loading')}
                    </td>
                  </tr>
                ) : safeRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length || 1} className={emptyCellClass}>
                      {emptyContent || t('noData')}
                    </td>
                  </tr>
                ) : (
                  safeRows.map((row, rowIndex) => (
                    <tr
                      key={String(keyFn(row))}
                      className={`group ${clickable ? 'cursor-pointer' : ''}`.trim()}
                      onClick={clickable ? () => onRowClick(row) : undefined}
                    >
                      {visibleColumns.map((column) => {
                        const align = getAlignClass(column.align);
                        const stickyLeft = stickyLeftMap.get(column.id);
                        const isPinned = stickyLeftMap.has(column.id);
                        const width = Number(column.width || defaultColumnWidth);
                        const minWidth = getColumnMinWidth(column, Math.max(72, defaultColumnWidth - 16));
                        const isEven = rowIndex % 2 === 0;
                        return (
                          <td
                            key={column.id}
                            className={`${tdClass} ${align} border-b border-slate-100 ${isPinned ? 'sticky z-10 bg-white group-hover:bg-slate-50/85' : ''} ${
                              clickable ? 'group-hover:bg-slate-50/70' : ''
                            } ${isEven && !clickable ? 'bg-white' : ''} ${column.className || ''}`.trim()}
                            style={{
                              ...column.cellStyle,
                              width,
                              minWidth,
                              maxWidth: column.maxWidth,
                              left: isPinned ? stickyLeft : undefined,
                              boxShadow: isPinned ? '1px 0 0 rgba(148,163,184,0.16)' : undefined
                            }}
                          >
                            {typeof column.cell === 'function' ? column.cell(row) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>

      {bottom ? <div className="border-t border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-3">{bottom}</div> : null}
    </div>
  );
}
