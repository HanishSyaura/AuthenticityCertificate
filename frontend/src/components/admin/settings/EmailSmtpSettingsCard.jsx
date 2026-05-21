import React, { useEffect, useState } from 'react';
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

  const [editingPass, setEditingPass] = useState(false);
  useEffect(() => {
    if (!draft?.smtpPassSet) setEditingPass(true);
  }, [draft?.smtpPassSet]);

  const passPlaceholder = draft?.smtpPassSet && !editingPass ? '••••••••' : '';
  const passDisabled = !canEdit || (draft?.smtpPassSet && !editingPass);

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

      <div className="mt-5">
        <div className="text-xs font-semibold text-zinc-700">{t('smtpConfiguration')}</div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('smtpHost')} error={errors?.smtpHost} htmlFor="smtp-host">
            <Input
              id="smtp-host"
              value={draft.smtpHost}
              onChange={(v) => onChange({ smtpHost: v })}
              disabled={!canEdit}
              placeholder="smtp.example.com"
            />
          </Field>

          <Field label={t('smtpPort')} error={errors?.smtpPort} htmlFor="smtp-port">
            <Input
              id="smtp-port"
              value={draft.smtpPort}
              onChange={(v) => onChange({ smtpPort: v })}
              disabled={!canEdit}
              type="number"
              placeholder="587"
            />
          </Field>

          <Field label={t('smtpUser')} error={errors?.smtpUser} htmlFor="smtp-user">
            <Input
              id="smtp-user"
              value={draft.smtpUser}
              onChange={(v) => onChange({ smtpUser: v })}
              disabled={!canEdit}
              placeholder="it.team@example.com"
            />
          </Field>

          <Field label={t('smtpPass')} hint={draft.smtpPassSet ? t('smtpPassSetHint') : t('smtpPassHint')} error={errors?.smtpPass} htmlFor="smtp-pass">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  id="smtp-pass"
                  value={draft.smtpPass}
                  onChange={(v) => onChange({ smtpPass: v })}
                  disabled={passDisabled}
                  type="password"
                  placeholder={passPlaceholder}
                  autoComplete="new-password"
                />
              </div>
              {draft.smtpPassSet ? (
                <button
                  type="button"
                  onClick={() => setEditingPass(true)}
                  disabled={!canEdit || editingPass}
                  className="ac-btn ac-btn-soft px-3 py-2"
                >
                  {t('change')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setEditingPass(false);
                  onClearPassword?.();
                }}
                disabled={!canEdit || (!draft.smtpPassSet && !draft.smtpPass)}
                className="ac-btn ac-btn-soft px-3 py-2"
              >
                {t('clear')}
              </button>
            </div>
          </Field>

          <Field label={t('smtpFromName')} error={errors?.smtpFromName} htmlFor="smtp-from-name">
            <Input id="smtp-from-name" value={draft.smtpFromName} onChange={(v) => onChange({ smtpFromName: v })} disabled={!canEdit} placeholder="DMS System" />
          </Field>

          <Field label={t('smtpFromEmail')} error={errors?.smtpFromEmail} htmlFor="smtp-from-email">
            <Input
              id="smtp-from-email"
              value={draft.smtpFromEmail}
              onChange={(v) => onChange({ smtpFromEmail: v })}
              disabled={!canEdit}
              placeholder="noreply@example.com"
            />
          </Field>

          <Field label={t('smtpReplyTo')} error={errors?.smtpReplyTo} htmlFor="smtp-reply-to">
            <Input
              id="smtp-reply-to"
              value={draft.smtpReplyTo}
              onChange={(v) => onChange({ smtpReplyTo: v })}
              disabled={!canEdit}
              placeholder="support@example.com"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label={t('adminAppUrl')} error={errors?.adminAppUrl} hint={t('adminAppUrlHint')} htmlFor="smtp-admin-app-url">
              <Input
                id="smtp-admin-app-url"
                value={draft.adminAppUrl}
                onChange={(v) => onChange({ adminAppUrl: v })}
                disabled={!canEdit}
                placeholder="https://your-domain.com"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-zinc-200/70 pt-5">
        <div className="text-xs font-semibold text-zinc-700">{t('notificationEvents')}</div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
            <div className="text-xs font-medium text-zinc-700">{t('epcGeneratedEmailNotify')}</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{t('epcGeneratedEmailNotifyHint')}</div>
            <div className="mt-2 flex items-center gap-3">
              <Toggle checked={Boolean(draft.epcGeneratedEmailNotifyEnabled)} onChange={(v) => onChange({ epcGeneratedEmailNotifyEnabled: v })} disabled={!canEdit} />
              <div className="text-sm text-zinc-700">{draft.epcGeneratedEmailNotifyEnabled ? t('enabled') : t('disabled')}</div>
            </div>
            <div className="mt-3">
              <Field label={t('notificationRoles')} hint={t('notificationRolesHint')} error={errors?.epcGeneratedEmailNotifyRoles} htmlFor="smtp-notify-roles-1">
                <Input
                  id="smtp-notify-roles-1"
                  value={draft.epcGeneratedEmailNotifyRoles || ''}
                  onChange={(v) => onChange({ epcGeneratedEmailNotifyRoles: v })}
                  disabled={!canEdit}
                  placeholder="operator, epc_pic"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
            <div className="text-xs font-medium text-zinc-700">{t('epcProductionOrdersEmailNotify')}</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{t('epcProductionOrdersEmailNotifyHint')}</div>
            <div className="mt-2 flex items-center gap-3">
              <Toggle
                checked={Boolean(draft.epcProductionOrdersEmailNotifyEnabled)}
                onChange={(v) => onChange({ epcProductionOrdersEmailNotifyEnabled: v })}
                disabled={!canEdit}
              />
              <div className="text-sm text-zinc-700">{draft.epcProductionOrdersEmailNotifyEnabled ? t('enabled') : t('disabled')}</div>
            </div>
            <div className="mt-3">
              <Field
                label={t('notificationRoles')}
                hint={t('notificationRolesHint')}
                error={errors?.epcProductionOrdersEmailNotifyRoles}
                htmlFor="smtp-notify-roles-2"
              >
                <Input
                  id="smtp-notify-roles-2"
                  value={draft.epcProductionOrdersEmailNotifyRoles || ''}
                  onChange={(v) => onChange({ epcProductionOrdersEmailNotifyRoles: v })}
                  disabled={!canEdit}
                  placeholder="operator, epc_pic"
                />
              </Field>
            </div>
          </div>
        </div>
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

        <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label={t('testRecipientEmail')} error={testErrors?.to} htmlFor="smtp-test-to">
            <Input id="smtp-test-to" value={testDraft.to} onChange={(v) => onChangeTest({ to: v })} disabled={testSending} type="email" />
          </Field>
          <button type="button" className="ac-btn ac-btn-soft px-3 py-2" onClick={onSendTest} disabled={testSending || !canEdit}>
            {testSending ? t('sending') : t('sendTestEmail')}
          </button>
        </div>
      </div>
    </div>
  );
}
