import React from 'react';
import { Field, Input, Select, Toggle } from './SettingsControls';

export default function SystemSettingsCard({
  title,
  hint,
  canEdit,
  draft,
  errors,
  notice,
  dirty,
  invalid,
  saving,
  localeOptions,
  timezoneOptions,
  onChange,
  onSave
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>

      {!canEdit ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Only Super Admin can edit system settings.
        </div>
      ) : null}

      {notice?.text ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Organization name" error={errors?.organizationName} htmlFor="system-org-name">
          <Input id="system-org-name" value={draft.organizationName} onChange={(v) => onChange({ organizationName: v })} disabled={!canEdit} />
        </Field>

        <Field label="Organization code" error={errors?.organizationCode} hint="Uppercase and unique" htmlFor="system-org-code">
          <Input
            id="system-org-code"
            value={draft.organizationCode}
            onChange={(v) => onChange({ organizationCode: v.toUpperCase() })}
            disabled={!canEdit}
          />
        </Field>

        <Field label="Default locale" error={errors?.defaultLocale} htmlFor="system-locale">
          <Select
            id="system-locale"
            value={draft.defaultLocale}
            onChange={(v) => onChange({ defaultLocale: v })}
            disabled={!canEdit}
            options={localeOptions}
          />
        </Field>

        <Field label="Default timezone" error={errors?.defaultTimezone} htmlFor="system-timezone">
          <Select
            id="system-timezone"
            value={draft.defaultTimezone}
            onChange={(v) => onChange({ defaultTimezone: v })}
            disabled={!canEdit}
            options={timezoneOptions}
          />
        </Field>

        <Field label="Maintenance mode" hint="Temporarily disable non-admin access">
          <div className="flex items-center gap-3">
            <Toggle checked={draft.maintenanceMode} onChange={(v) => onChange({ maintenanceMode: v })} disabled={!canEdit} />
            <div className="text-sm text-zinc-700">{draft.maintenanceMode ? 'Enabled' : 'Disabled'}</div>
          </div>
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || !dirty || invalid || saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
