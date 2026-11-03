import React, { useState } from 'react';

const emptyForm = {
  fieldKey: '',
  label: '',
  fieldType: 'text',
  placeholder: '',
  helpText: '',
  defaultEntryMode: 'both',
  isRequired: false,
  isActive: true,
  sortOrder: 0
};

export default function EpcDynamicFieldsPanel({
  t,
  fields = [],
  loading = false,
  error = null,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete
}) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const text = (key, fallback) => {
    const value = t?.(key);
    return !value || value === key ? fallback : value;
  };

  const change = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  };

  const startEdit = (field) => {
    setEditingId(field.id);
    setForm({
      fieldKey: field.fieldKey || '',
      label: field.label || '',
      fieldType: field.fieldType || 'text',
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      defaultEntryMode: field.defaultEntryMode || 'both',
      isRequired: Boolean(field.isRequired),
      isActive: Boolean(field.isActive),
      sortOrder: Number(field.sortOrder) || 0
    });
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');

    const label = String(form.label || '').trim();
    const fieldKey = String(form.fieldKey || '').trim();

    if (!label) {
      setFormError(text('fieldLabelRequired', 'Field label is required.'));
      return;
    }

    if (!editingId && !fieldKey) {
      setFormError(text('fieldKeyRequired', 'Field key is required.'));
      return;
    }

    const payload = {
      ...form,
      ...(fieldKey ? { fieldKey } : {}),
      label,
      placeholder: String(form.placeholder || '').trim(),
      helpText: String(form.helpText || '').trim(),
      sortOrder: Math.max(0, Math.floor(Number(form.sortOrder) || 0))
    };

    setSaving(true);
    try {
      if (editingId != null) {
        await onUpdate?.({ fieldId: editingId, input: payload });
      } else {
        await onCreate?.(payload);
      }
      reset();
      await onRefresh?.();
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
        err?.message ||
        text('operationFailed', 'Unable to save the field.')
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (field) => {
    try {
      await onUpdate?.({
        fieldId: field.id,
        input: { isActive: !field.isActive }
      });
      await onRefresh?.();
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
        err?.message ||
        text('operationFailed', 'Unable to update the field.')
      );
    }
  };

  const removeField = async (field) => {
    const confirmed = window.confirm(
      `Delete field "${field.label || field.fieldKey}"?`
    );
    if (!confirmed) return;

    setFormError('');
    try {
      await onDelete?.(field.id);
      if (editingId === field.id) reset();
      await onRefresh?.();
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
        err?.message ||
        text('operationFailed', 'Unable to delete the field.')
      );
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

  return (
    <div className="space-y-5">
      {(error || formError) ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError || String(error)}
        </div>
      ) : null}

      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId != null
              ? text('editFieldTitle', 'Edit field')
              : text('addField', 'Add field')}
          </h3>
          <button
            type="button"
            onClick={() => onRefresh?.()}
            disabled={loading || saving}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {text('refresh', 'Refresh')}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block text-xs font-medium text-slate-700">
            {text('fieldLabel', 'Label')} *
            <input
              id="epc-field-label"
              name="label"
              className={inputClass + ' mt-1.5'}
              value={form.label}
              onChange={(e) => change('label', e.target.value)}
              maxLength={191}
              required
              disabled={saving}
              placeholder={text('fieldLabelExample', 'e.g. Harvest Lot')}
            />
          </label>

          <label className="block text-xs font-medium text-slate-700">
            {text('fieldKey', 'Field key')} {!editingId ? '*' : ''}
            <input
              id="epc-field-key"
              name="fieldKey"
              className={inputClass + ' mt-1.5'}
              value={form.fieldKey}
              onChange={(e) => change('fieldKey', e.target.value)}
              maxLength={64}
              required={!editingId}
              disabled={saving}
              placeholder={text('fieldKeyExample', 'e.g. harvest_lot')}
            />
          </label>

          <label className="block text-xs font-medium text-slate-700">
            {text('fieldType', 'Field type')}
            <select
              id="epc-field-type"
              name="fieldType"
              className={inputClass + ' mt-1.5'}
              value={form.fieldType}
              onChange={(e) => change('fieldType', e.target.value)}
              disabled={saving}
            >
              <option value="text">{text('textType', 'Text')}</option>
              <option value="number">{text('numberType', 'Number')}</option>
              <option value="date">{text('dateType', 'Date')}</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-700">
            {text('placeholder', 'Placeholder')}
            <input
              id="epc-field-placeholder"
              name="placeholder"
              className={inputClass + ' mt-1.5'}
              value={form.placeholder}
              onChange={(e) => change('placeholder', e.target.value)}
              maxLength={191}
              disabled={saving}
            />
          </label>

          <label className="block text-xs font-medium text-slate-700">
            {text('helpText', 'Help text')}
            <input
              id="epc-field-help-text"
              name="helpText"
              className={inputClass + ' mt-1.5'}
              value={form.helpText}
              onChange={(e) => change('helpText', e.target.value)}
              maxLength={191}
              disabled={saving}
            />
          </label>

          <label className="block text-xs font-medium text-slate-700">
            {text('defaultEntryMode', 'Default entry mode')}
            <select
              id="epc-field-default-entry-mode"
              name="defaultEntryMode"
              className={inputClass + ' mt-1.5'}
              value={form.defaultEntryMode}
              onChange={(e) => change('defaultEntryMode', e.target.value)}
              disabled={saving}
            >
              <option value="both">{text('batchAndIndividual', 'Batch + individual')}</option>
              <option value="batch">{text('batchOnly', 'Batch only')}</option>
              <option value="individual">{text('individualOnly', 'Individual only')}</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-slate-700">
            {text('sortOrder', 'Sort order')}
            <input
              id="epc-field-sort-order"
              name="sortOrder"
              type="number"
              min="0"
              max="999"
              className={inputClass + ' mt-1.5'}
              value={form.sortOrder}
              onChange={(e) => change('sortOrder', e.target.value)}
              disabled={saving}
            />
          </label>

          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-700 md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                id="epc-field-required"
                name="isRequired"
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) => change('isRequired', e.target.checked)}
                disabled={saving}
              />
              {text('required', 'Required')}
            </label>
            <label className="flex items-center gap-2">
              <input
                id="epc-field-active"
                name="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => change('isActive', e.target.checked)}
                disabled={saving}
              />
              {text('active', 'Active')}
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? text('saving', 'Saving...') : text('save', 'Save')}
          </button>
          {editingId != null ? (
            <button
              type="button"
              onClick={reset}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              {text('cancel', 'Cancel')}
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3">{text('order', 'Order')}</th>
              <th className="px-4 py-3">{text('fieldLabel', 'Label')}</th>
              <th className="px-4 py-3">{text('fieldKey', 'Field key')}</th>
              <th className="px-4 py-3">{text('fieldType', 'Type')}</th>
              <th className="px-4 py-3">{text('defaultEntryMode', 'Entry mode')}</th>
              <th className="px-4 py-3">{text('status', 'Status')}</th>
              <th className="px-4 py-3">{text('actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  {loading
                    ? text('loading', 'Loading...')
                    : text('noDynamicFieldsYet', 'No dynamic fields yet.')}
                </td>
              </tr>
            ) : fields.map((field) => (
              <tr key={field.id ?? field.fieldKey} className="hover:bg-slate-50">
                <td className="px-4 py-3">{Number(field.sortOrder) || 0}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {field.label || '-'}
                  {field.isRequired ? <span className="ml-1 text-red-600">*</span> : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{field.fieldKey}</td>
                <td className="px-4 py-3">{field.fieldType || 'text'}</td>
                <td className="px-4 py-3">{field.defaultEntryMode || 'both'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${field.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {field.isActive ? text('active', 'Active') : text('inactive', 'Inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(field)} className="text-xs font-medium text-blue-700 hover:underline">
                      {text('edit', 'Edit')}
                    </button>
                    <button type="button" onClick={() => toggleActive(field)} disabled={saving} className="text-xs font-medium text-slate-700 hover:underline">
                      {field.isActive ? text('deactivate', 'Deactivate') : text('activate', 'Activate')}
                    </button>
                    <button type="button" onClick={() => removeField(field)} disabled={saving} className="text-xs font-medium text-red-700 hover:underline">
                      {text('delete', 'Delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
