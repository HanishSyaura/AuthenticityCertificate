import React, { useMemo } from 'react';
import { Field, Input } from './SettingsControls';

export default function ProfileSettingsCard({
  title,
  hint,
  canEditEmail,
  draft,
  errors,
  notice,
  dirty,
  invalid,
  saving,
  onChange,
  onSave
}) {
  const showCurrent = useMemo(() => Boolean(String(draft.newPassword || '').trim()), [draft.newPassword]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>

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
        <Field label="Name" error={errors?.name} htmlFor="profile-name">
          <Input id="profile-name" value={draft.name} onChange={(v) => onChange({ name: v })} />
        </Field>

        <Field label="Email" error={errors?.email} hint={!canEditEmail ? 'Only admins can edit email' : ''} htmlFor="profile-email">
          <Input id="profile-email" value={draft.email} onChange={(v) => onChange({ email: v })} disabled={!canEditEmail} type="email" />
        </Field>

        <Field label="Role" htmlFor="profile-role">
          <Input id="profile-role" value={draft.role} onChange={() => {}} disabled />
        </Field>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {showCurrent ? (
          <Field label="Current password" error={errors?.currentPassword} htmlFor="profile-current-password">
            <Input
              id="profile-current-password"
              value={draft.currentPassword}
              onChange={(v) => onChange({ currentPassword: v })}
              type="password"
            />
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}

        <Field label="New password" error={errors?.newPassword} htmlFor="profile-new-password">
          <Input
            id="profile-new-password"
            value={draft.newPassword}
            onChange={(v) => onChange({ newPassword: v })}
            type="password"
            placeholder="Leave blank to keep current password"
          />
        </Field>

        <Field label="Confirm new password" error={errors?.confirmNewPassword} htmlFor="profile-confirm-new-password">
          <Input
            id="profile-confirm-new-password"
            value={draft.confirmNewPassword}
            onChange={(v) => onChange({ confirmNewPassword: v })}
            type="password"
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || invalid || saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
