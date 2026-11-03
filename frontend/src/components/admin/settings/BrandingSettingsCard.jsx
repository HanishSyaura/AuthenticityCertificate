import React from 'react';
import { Field, Input, TextArea } from './SettingsControls';
import { useT } from '../../../i18n/useT';

export default function BrandingSettingsCard({
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
  onChange,
  onUploadLogo,
  onUploadFavicon,
  onSave
}) {
  const { t } = useT();
  const disabled = !canEdit || saving;
  const saveDisabled = disabled || !dirty || invalid;

  const uploadField = (label, field, uploading, uploadError, onUpload, accept) => (
    <div className="space-y-3">
      <Field label={label} htmlFor={`branding-${field}`}>
        <Input
          id={`branding-${field}`}
          value={draft[field] || ''}
          onChange={(value) => onChange({ [field]: value })}
          disabled={disabled || uploading}
          placeholder="https://example.com/image.png"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <label className={`ac-btn cursor-pointer px-4 py-2 ${disabled || uploading ? 'pointer-events-none opacity-60' : ''}`}>
          {uploading ? 'Uploading…' : `Upload ${label}`}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = '';
            }}
          />
        </label>

        {draft[field] ? (
          <a
            href={draft[field]}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blue-700 underline"
          >
            Preview / Open
          </a>
        ) : null}
      </div>

      {uploadError ? (
        <p className="text-xs text-red-600">{uploadError}</p>
      ) : null}

      {draft[field] ? (
        <div className="flex min-h-20 items-center rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <img
            src={draft[field]}
            alt={`${label} preview`}
            className="max-h-16 max-w-full object-contain"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="ac-card overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-[#e8edf3] bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fc_100%)] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{hint}</p>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className="ac-btn shrink-0 px-4 py-2.5"
        >
          {saving ? t('saving') : t('saveChanges')}
        </button>
      </div>

      {notice?.text ? (
        <div
          role="status"
          className={`mx-5 mt-5 rounded-xl border px-4 py-3 text-sm sm:mx-6 ${
            notice.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:mx-6">
          You have read-only access to these settings.
        </div>
      ) : null}

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <section className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-zinc-900">
            Organization
          </h3>
          <p className="mb-4 text-xs leading-5 text-zinc-500">
            Configure the organization name and code displayed by the application.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Organization Name" htmlFor="branding-organizationName">
              <Input
                id="branding-organizationName"
                value={draft.organizationName || ''}
                onChange={(value) => onChange({ organizationName: value })}
                disabled={disabled}
              />
            </Field>

            <Field
              label="Organization Code"
              htmlFor="branding-organizationCode"
              error={errors?.organizationCode}
              hint="Use uppercase letters, numbers, hyphens or underscores."
            >
              <Input
                id="branding-organizationCode"
                value={draft.organizationCode || ''}
                onChange={(value) => onChange({ organizationCode: value })}
                disabled={disabled}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-zinc-900">
            Application Identity
          </h3>
          <p className="mb-4 text-xs leading-5 text-zinc-500">
            Set the application title and primary theme color.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Application Title" htmlFor="branding-appTitle">
              <Input
                id="branding-appTitle"
                value={draft.appTitle || ''}
                onChange={(value) => onChange({ appTitle: value })}
                disabled={disabled}
                placeholder="Application name"
              />
            </Field>

            <Field
              label="Primary Theme Color"
              htmlFor="branding-themePrimaryHex"
              error={errors?.themePrimaryHex}
              hint="Enter a six-digit hexadecimal color, such as #2563EB."
            >
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Choose primary theme color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(draft.themePrimaryHex || '')
                      ? draft.themePrimaryHex
                      : '#2563EB'
                  }
                  onChange={(event) =>
                    onChange({ themePrimaryHex: event.target.value })
                  }
                  disabled={disabled}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="min-w-0 flex-1">
                  <Input
                    id="branding-themePrimaryHex"
                    value={draft.themePrimaryHex || ''}
                    onChange={(value) => onChange({ themePrimaryHex: value })}
                    disabled={disabled}
                    placeholder="#2563EB"
                  />
                </div>
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-zinc-900">
            Login Page Content
          </h3>
          <p className="mb-4 text-xs leading-5 text-zinc-500">
            Customize the badge, heading, description and highlighted messages shown on the login page.
          </p>

          <div className="space-y-4">
            <Field label="Hero Badge" htmlFor="branding-loginHeroBadge">
              <Input
                id="branding-loginHeroBadge"
                value={draft.loginHeroBadge || ''}
                onChange={(value) => onChange({ loginHeroBadge: value })}
                disabled={disabled}
                placeholder="e.g. Product Authenticity"
              />
            </Field>

            <Field label="Hero Title" htmlFor="branding-loginHeroTitle">
              <Input
                id="branding-loginHeroTitle"
                value={draft.loginHeroTitle || ''}
                onChange={(value) => onChange({ loginHeroTitle: value })}
                disabled={disabled}
                placeholder="Main login page heading"
              />
            </Field>

            <Field label="Hero Subtitle" htmlFor="branding-loginHeroSubtitle">
              <TextArea
                id="branding-loginHeroSubtitle"
                value={draft.loginHeroSubtitle || ''}
                onChange={(value) => onChange({ loginHeroSubtitle: value })}
                disabled={disabled}
                rows={3}
                placeholder="Supporting description"
              />
            </Field>

            <Field
              label="Hero Highlights"
              htmlFor="branding-loginHeroHighlights"
              hint="Enter multiple highlights separated by commas."
            >
              <TextArea
                id="branding-loginHeroHighlights"
                value={draft.loginHeroHighlights || ''}
                onChange={(value) => onChange({ loginHeroHighlights: value })}
                disabled={disabled}
                rows={3}
                placeholder="e.g. Secure Verification, Product Traceability"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5ebf1] bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-zinc-900">
            Brand Assets
          </h3>
          <p className="mb-4 text-xs leading-5 text-zinc-500">
            Provide image URLs or upload the logo and favicon. Uploaded assets will be saved when you save the branding settings.
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {uploadField(
              'Logo',
              'logoUrl',
              logoUploading,
              logoUploadError,
              onUploadLogo,
              'image/*'
            )}

            {uploadField(
              'Favicon',
              'faviconUrl',
              faviconUploading,
              faviconUploadError,
              onUploadFavicon,
              'image/*,.ico'
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <p className="text-xs text-zinc-500">
            {dirty ? 'You have unsaved changes.' : 'All changes are saved.'}
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className="ac-btn px-5 py-2.5"
          >
            {saving ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
