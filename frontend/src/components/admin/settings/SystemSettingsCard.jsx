import React from 'react';
import { Field, Input, Select, Toggle } from './SettingsControls';
import { MAX_UPLOAD_MB } from '../../../utils/uploadLimits';
import { useT } from '../../../i18n/useT';
import { resolvePublicMediaUrl } from '../../../utils/apiBase';

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
  faviconUploading,
  faviconUploadError,
  localeOptions,
  timezoneOptions,
  onChange,
  onUploadLogo,
  onUploadFavicon,
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

        <div className="sm:col-span-2">
          <Field label={t('appTitle')} hint={t('appTitleHint')} error={errors?.appTitle} htmlFor="system-app-title">
            <Input
              id="system-app-title"
              value={draft.appTitle}
              onChange={(v) => onChange({ appTitle: v })}
              disabled={!canEdit}
              placeholder={t('appTitlePlaceholder')}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label={t('favicon')} hint={t('faviconHint')} error={faviconUploadError}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50">
                {draft.faviconUrl ? (
                  <img src={resolvePublicMediaUrl(draft.faviconUrl)} alt={t('favicon')} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-[11px] text-zinc-500">{t('none')}</div>
                )}
              </div>

              <label
                className={`ac-btn ac-btn-soft cursor-pointer px-3 py-2 ${
                  !canEdit || faviconUploading ? 'cursor-not-allowed opacity-50 hover:bg-white' : ''
                }`}
              >
                {faviconUploading ? t('uploading') : t('uploadImage')}
                <input
                  type="file"
                  accept="image/*,.ico"
                  disabled={!canEdit || faviconUploading}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.target.value = '';
                    if (f) onUploadFavicon?.(f);
                  }}
                />
              </label>

              <div className="text-[11px] text-zinc-500">{t('maxFileSize', { mb: MAX_UPLOAD_MB })}</div>

              <button
                type="button"
                disabled={!canEdit || faviconUploading || !draft.faviconUrl}
                onClick={() => onChange({ faviconUrl: '' })}
                className="ac-btn ac-btn-soft px-3 py-2"
              >
                {t('remove')}
              </button>
            </div>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label={t('brandLogo')} hint={t('brandLogoHint')} error={logoUploadError}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 w-48 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50">
                {draft.logoUrl ? (
                  <img src={resolvePublicMediaUrl(draft.logoUrl)} alt={t('brandLogo')} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-xs text-zinc-500">{t('noLogo')}</div>
                )}
              </div>

              <label
                className={`ac-btn ac-btn-soft cursor-pointer px-3 py-2 ${
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
