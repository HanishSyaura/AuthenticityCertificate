import React from 'react';

export default function EpcDynamicEntryGrid({
  t,
  fieldSchema = [],
  previewItems = [],
  selectedEpcs = new Set(),
  allSelectableChecked = false,
  selectableRows = [],
  rowValues = {},
  batchFillValues = {},
  onToggleAll,
  onToggleRow,
  onChangeRowValue,
  onChangeBatchFill,
  onApplyBatchFill
}) {
  const text = (key, fallback) => {
    const value = t?.(key);
    return !value || value === key ? fallback : value;
  };

  const fields = Array.isArray(fieldSchema) ? fieldSchema : [];
  const rows = Array.isArray(previewItems) ? previewItems : [];
  const selectedCount = selectedEpcs?.size || 0;

  const getValue = (row, field) => {
    const code = String(row?.epcCode || '');
    const key = String(field?.fieldKey || field?.key || '');
    const current = rowValues?.[code]?.[key];
    if (current !== undefined && current !== null) return String(current);
    const existing = row?.values?.[key] ?? row?.dynamicValues?.[key] ?? '';
    return existing == null ? '' : String(existing);
  };

  const getInputType = (field) => {
    const type = String(field?.fieldType || field?.type || 'text').toLowerCase();
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          {text('selectedEpcsCount', '{{value}} EPC selected').replace('{{value}}', String(selectedCount))}
        </span>
        <span>{rows.length} EPC row(s)</span>
      </div>

      {fields.length > 0 && selectedCount > 0 ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-700">
            {text('fillForSelectedEpcs', 'Fill values for selected EPCs')}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fields.map((field) => {
              const key = String(field?.fieldKey || field?.key || '');
              if (!key) return null;
              return (
                <div key={key} className="flex min-w-0 items-end gap-2">
                  <label className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                    {field?.label || key}
                    <input
                      id={`epc-batch-fill-${key}`}
                      name={`batchFill-${key}`}
                      type={getInputType(field)}
                      value={batchFillValues?.[key] ?? ''}
                      onChange={(e) => onChangeBatchFill?.(key, e.target.value)}
                      placeholder={field?.placeholder || ''}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onApplyBatchFill?.(key)}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-100"
                  >
                    {text('applyToSelected', 'Apply to selected')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
            <tr>
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label={text('selectAllReady', 'Select all selectable EPCs')}
                  checked={Boolean(allSelectableChecked)}
                  disabled={selectableRows.length === 0}
                  onChange={() => onToggleAll?.()}
                />
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3">
                {text('epcCode', 'EPC code')}
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3">
                {text('previewStatus', 'Preview status')}
              </th>
              {fields.map((field) => {
                const key = String(field?.fieldKey || field?.key || '');
                return key ? (
                  <th key={key} className="min-w-48 whitespace-nowrap border-b border-slate-200 px-3 py-3">
                    <div>{field?.label || key}</div>
                    <div className="mt-1 font-normal text-slate-500">{key}</div>
                  </th>
                ) : null;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3 + fields.length} className="px-4 py-10 text-center text-slate-500">
                  {text('noSelectableEpcs', 'No EPC rows available.')}
                </td>
              </tr>
            ) : rows.map((row, index) => {
              const code = String(row?.epcCode || '');
              const selectable = Boolean(row?.selectable && code);
              const checked = selectedEpcs?.has(code) || false;
              return (
                <tr key={code || index} className={checked ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
                  <td className="border-b border-slate-100 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      disabled={!selectable}
                      onChange={(e) => onToggleRow?.(code, e.target.checked)}
                      aria-label={`Select ${code || 'EPC row'}`}
                    />
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2.5 font-mono text-slate-800">
                    {code || '-'}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2.5">
                    <span className={`rounded-full px-2 py-1 ${selectable ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row?.status || row?.previewStatus || (selectable ? text('selectableEpcs', 'Selectable') : text('notAvailable', 'Unavailable'))}
                    </span>
                    {row?.reason ? <div className="mt-1 max-w-56 text-slate-500">{String(row.reason)}</div> : null}
                  </td>
                  {fields.map((field) => {
                    const key = String(field?.fieldKey || field?.key || '');
                    if (!key) return null;
                    return (
                      <td key={key} className="border-b border-slate-100 px-3 py-2">
                        <input
                          id={`epc-row-${index}-${key}`}
                          name={`epc-${code || index}-${key}`}
                          type={getInputType(field)}
                          value={getValue(row, field)}
                          onChange={(e) => onChangeRowValue?.(code, key, e.target.value)}
                          placeholder={field?.placeholder || ''}
                          required={Boolean(field?.isRequired)}
                          disabled={!selectable}
                          aria-label={`${field?.label || key} for EPC ${code || index + 1}`}
                          title={field?.helpText || field?.label || key}
                          className="w-full min-w-40 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs disabled:bg-slate-100"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
