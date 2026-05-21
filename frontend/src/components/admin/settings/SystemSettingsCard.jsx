import React from 'react';
import { Field, Input, Select, Toggle } from './SettingsControls';
import { MAX_UPLOAD_MB } from '../../../utils/uploadLimits';
import { useT } from '../../../i18n/useT';

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
  logoUploading,
  logoUploadError,
  localeOptions,
  timezoneOptions,
  onChange,
  onUploadLogo,
  onSave
}) {
  const { t } = useT();
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
            notice.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('organizationName')} error={errors?.organizationName} htmlFor="system-org-name">
          <Input id="system-org-name" value={draft.organizationName} onChange={(v) => onChange({ organizationName: v })} disabled={!canEdit} />
        </Field>

        <Field label={t('organizationCode')} error={errors?.organizationCode} hint={t('organizationCodeHint')} htmlFor="system-org-code">
          <Input
            id="system-org-code"
            value={draft.organizationCode}
            onChange={(v) => onChange({ organizationCode: v.toUpperCase() })}
            disabled={!canEdit}
          />
        </Field>

        <Field label={t('defaultLocale')} error={errors?.defaultLocale} htmlFor="system-locale">
          <Select
            id="system-locale"
            value={draft.defaultLocale}
            onChange={(v) => onChange({ defaultLocale: v })}
            disabled={!canEdit}
            options={localeOptions}
          />
        </Field>

        <Field label={t('defaultTimezone')} error={errors?.defaultTimezone} htmlFor="system-timezone">
          <Select
            id="system-timezone"
            value={draft.defaultTimezone}
            onChange={(v) => onChange({ defaultTimezone: v })}
            disabled={!canEdit}
            options={timezoneOptions}
          />
        </Field>

        <Field label={t('maintenanceMode')} hint={t('maintenanceModeHint')}>
          <div className="flex items-center gap-3">
            <Toggle checked={draft.maintenanceMode} onChange={(v) => onChange({ maintenanceMode: v })} disabled={!canEdit} />
            <div className="text-sm text-zinc-700">{draft.maintenanceMode ? t('enabled') : t('disabled')}</div>
          </div>
        </Field>

        <Field label={t('epcGeneratedEmailNotify')} hint={t('epcGeneratedEmailNotifyHint')}>
          <div className="flex items-center gap-3">
            <Toggle
              checked={Boolean(draft.epcGeneratedEmailNotifyEnabled)}
              onChange={(v) => onChange({ epcGeneratedEmailNotifyEnabled: v })}
              disabled={!canEdit}
            />
            <div className="text-sm text-zinc-700">{draft.epcGeneratedEmailNotifyEnabled ? t('enabled') : t('disabled')}</div>
          </div>
        </Field>

        <Field label={t('notificationRoles')} hint={t('notificationRolesHint')} error={errors?.epcGeneratedEmailNotifyRoles} htmlFor="notify-epc-generated-roles">
          <Input
            id="notify-epc-generated-roles"
            value={draft.epcGeneratedEmailNotifyRoles || ''}
            onChange={(v) => onChange({ epcGeneratedEmailNotifyRoles: v })}
            disabled={!canEdit}
            placeholder="operator, epc_pic"
          />
        </Field>

        <Field label={t('epcProductionOrdersEmailNotify')} hint={t('epcProductionOrdersEmailNotifyHint')}>
          <div className="flex items-center gap-3">
            <Toggle
              checked={Boolean(draft.epcProductionOrdersEmailNotifyEnabled)}
              onChange={(v) => onChange({ epcProductionOrdersEmailNotifyEnabled: v })}
              disabled={!canEdit}
            />
            <div className="text-sm text-zinc-700">{draft.epcProductionOrdersEmailNotifyEnabled ? t('enabled') : t('disabled')}</div>
          </div>
        </Field>

        <Field
          label={t('notificationRoles')}
          hint={t('notificationRolesHint')}
          error={errors?.epcProductionOrdersEmailNotifyRoles}
          htmlFor="notify-epc-production-roles"
        >
          <Input
            id="notify-epc-production-roles"
            value={draft.epcProductionOrdersEmailNotifyRoles || ''}
            onChange={(v) => onChange({ epcProductionOrdersEmailNotifyRoles: v })}
            disabled={!canEdit}
            placeholder="operator, epc_pic"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label={t('brandLogo')} hint={t('brandLogoHint')} error={logoUploadError}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 w-48 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt={t('brandLogo')} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-xs text-zinc-500">{t('noLogo')}</div>
                )}
              </div>

              <label
                className={`inline-flex cursor-pointer items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 ${
                  !canEdit || logoUploading ? 'cursor-not-allowed opacity-50 hover:bg-white' : ''
                }`}
              >
                {logoUploading ? t('uploading') : t('uploadImage')}
                <input
                  type="file"
                  accept="image/*"
                  disabled={!canEdit || logoUploading}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.target.value = '';
                    if (f) onUploadLogo?.(f);
                  }}
                />
              </label>
              <div className="text-[11px] text-zinc-500">
                {t('maxFileSize', { mb: MAX_UPLOAD_MB })}
              </div>

              <button
                type="button"
                disabled={!canEdit || logoUploading || !draft.logoUrl}
                onClick={() => onChange({ logoUrl: '' })}
                className="ac-btn ac-btn-soft px-3 py-2"
              >
                {t('remove')}
              </button>
            </div>
          </Field>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || !dirty || saving}
          className="ac-btn px-4 py-2"
        >
          {saving ? t('saving') : t('saveSettings')}
        </button>
      </div>
    </div>
  );
}
