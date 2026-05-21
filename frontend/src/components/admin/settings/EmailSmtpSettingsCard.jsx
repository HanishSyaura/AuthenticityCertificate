import React from 'react';
import { Field, Input, Toggle } from './SettingsControls';
import { useT } from '../../../i18n/useT';

export default function EmailSmtpSettingsCard({
  title,
  hint,
  canEdit,
  draft,
  errors,
  notice,
  dirty,
  invalid,
  saving,
  testDraft,
  testErrors,
  testNotice,
  testSending,
  onChange,
  onClearPassword,
  onSave,
  onChangeTest,
  onSendTest
}) {
  const { t } = useT();

  const passPlaceholder = draft?.smtpPassSet ? '••••••••' : '';

  return (
    <div className="ac-card p-5">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>

      {!canEdit ? (
        <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          {t('onlySuperAdminCanEdit')}
        </div>
      ) : null}

      {notice?.text ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('smtpHost')} error={errors?.smtpHost} htmlFor="smtp-host">
          <Input id="smtp-host" value={draft.smtpHost} onChange={(v) => onChange({ smtpHost: v })} disabled={!canEdit} placeholder="smtp.example.com" />
        </Field>

        <Field label={t('smtpPort')} error={errors?.smtpPort} htmlFor="smtp-port">
          <Input id="smtp-port" value={draft.smtpPort} onChange={(v) => onChange({ smtpPort: v })} disabled={!canEdit} type="number" placeholder="587" />
        </Field>

        <Field label={t('smtpSecure')} hint={t('smtpSecureHint')}>
          <div className="flex items-center gap-3">
            <Toggle checked={Boolean(draft.smtpSecure)} onChange={(v) => onChange({ smtpSecure: v })} disabled={!canEdit} />
            <div className="text-sm text-zinc-700">{draft.smtpSecure ? t('enabled') : t('disabled')}</div>
          </div>
        </Field>

        <div className="hidden sm:block" />

        <Field label={t('smtpUser')} error={errors?.smtpUser} htmlFor="smtp-user">
          <Input id="smtp-user" value={draft.smtpUser} onChange={(v) => onChange({ smtpUser: v })} disabled={!canEdit} placeholder="user@example.com" />
        </Field>

        <Field
          label={t('smtpPass')}
          hint={draft.smtpPassSet ? t('smtpPassSetHint') : t('smtpPassHint')}
          error={errors?.smtpPass}
          htmlFor="smtp-pass"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1">
              <Input
                id="smtp-pass"
                value={draft.smtpPass}
                onChange={(v) => onChange({ smtpPass: v })}
                disabled={!canEdit}
                type="password"
                placeholder={passPlaceholder}
                autoComplete="new-password"
              />
            </div>
            <button
              type="button"
              onClick={onClearPassword}
              disabled={!canEdit || (!draft.smtpPassSet && !draft.smtpPass)}
              className="ac-btn ac-btn-soft px-3 py-2"
            >
              {t('clear')}
            </button>
          </div>
        </Field>

        <Field label={t('smtpFrom')} error={errors?.smtpFrom} htmlFor="smtp-from">
          <Input id="smtp-from" value={draft.smtpFrom} onChange={(v) => onChange({ smtpFrom: v })} disabled={!canEdit} placeholder="noreply@example.com" />
        </Field>

        <Field label={t('smtpReplyTo')} error={errors?.smtpReplyTo} htmlFor="smtp-reply-to">
          <Input id="smtp-reply-to" value={draft.smtpReplyTo} onChange={(v) => onChange({ smtpReplyTo: v })} disabled={!canEdit} placeholder="support@example.com" />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || !dirty || saving || invalid}
          className="ac-btn px-4 py-2"
        >
          {saving ? t('saving') : t('saveSettings')}
        </button>
      </div>

      <div className="mt-6 border-t border-zinc-200/70 pt-5">
        <div className="text-sm font-semibold text-zinc-900">{t('smtpTestEmail')}</div>
        <div className="mt-1 text-xs text-zinc-500">{t('smtpTestEmailHint')}</div>

        {testNotice?.text ? (
          <div
            className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
              testNotice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {testNotice.text}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label={t('to')} error={testErrors?.to} htmlFor="smtp-test-to">
              <Input id="smtp-test-to" value={testDraft.to} onChange={(v) => onChangeTest({ to: v })} disabled={testSending} type="email" />
            </Field>
          </div>
          <button type="button" className="ac-btn ac-btn-soft px-3 py-2" onClick={onSendTest} disabled={testSending || !canEdit}>
            {testSending ? t('sending') : t('sendTestEmail')}
          </button>
        </div>
      </div>
    </div>
  );
}

