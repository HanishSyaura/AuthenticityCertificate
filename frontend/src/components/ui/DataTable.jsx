import React from 'react';
import { useT } from '../../i18n/useT';

function getAlignClass(align) {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
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
  density,
  minWidth,
  containerClassName,
  tableClassName
}) {
  const { t } = useT();
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const keyFn = typeof rowKey === 'function' ? rowKey : (r) => r?.id;
  const clickable = typeof onRowClick === 'function';
  const isCompact = String(density || '') === 'compact';
  const thClass = `${isCompact ? 'px-3 py-2' : 'px-4 py-3'} text-xs font-semibold text-zinc-600`;
  const tdClass = `${isCompact ? 'px-3 py-2' : 'px-4 py-3'} text-sm text-zinc-800`;
  const loadingCellClass = `${isCompact ? 'px-3 py-5' : 'px-4 py-6'} text-sm text-zinc-600`;
  const emptyCellClass = `${isCompact ? 'px-3 py-8' : 'px-4 py-10'} text-center text-sm text-zinc-600`;

  return (
    <div className={`ac-table ${containerClassName || ''}`.trim()}>
      {top ? <div className="border-b border-zinc-200/70 bg-white px-4 py-3">{top}</div> : null}
      <div className="overflow-x-auto">
        <div style={minWidth ? { minWidth } : undefined}>
          <table className={`min-w-full text-sm ${tableClassName || ''}`.trim()}>
            <thead className="bg-zinc-50/60">
              <tr>
                {safeColumns.map((c) => {
                  const align = getAlignClass(c?.align);
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      className={`whitespace-nowrap border-b border-zinc-200/70 ${thClass} ${align} ${
                        c?.headerClassName || ''
                      }`.trim()}
                      style={c?.headerStyle}
                    >
                      {c.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/80 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={safeColumns.length || 1} className={loadingCellClass}>
                    {loadingContent || t('loading')}
                  </td>
                </tr>
              ) : safeRows.length === 0 ? (
                <tr>
                  <td colSpan={safeColumns.length || 1} className={emptyCellClass}>
                    {emptyContent || t('noData')}
                  </td>
                </tr>
              ) : (
                safeRows.map((r) => (
                  <tr
                    key={String(keyFn(r))}
                    className={`${clickable ? 'cursor-pointer hover:bg-zinc-50/60' : ''}`.trim()}
                    onClick={clickable ? () => onRowClick(r) : undefined}
                  >
                    {safeColumns.map((c) => {
                      const align = getAlignClass(c?.align);
                      return (
                        <td
                          key={c.id}
                          className={`${tdClass} ${align} ${c?.className || ''}`.trim()}
                          style={c?.cellStyle}
                        >
                          {typeof c.cell === 'function' ? c.cell(r) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {bottom ? <div className="border-t border-zinc-200/70 bg-white px-4 py-3">{bottom}</div> : null}
    </div>
  );
}
