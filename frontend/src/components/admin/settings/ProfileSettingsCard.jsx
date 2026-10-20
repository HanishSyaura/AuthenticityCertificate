import React, { useMemo } from 'react';
import { Field, Input, Select } from './SettingsControls';
import { useT } from '../../../i18n/useT';

export default function ProfileSettingsCard({
  title,
  hint,
  canEditEmail,
  draft,
  errors,
  notice,
  dirty,
  saving,
  languageOptions,
  onChange,
  onSave
}) {
  const { t } = useT();
  const showCurrent = useMemo(() => Boolean(String(draft.newPassword || '').trim()), [draft.newPassword]);
  const displayName = String(draft.name || '').trim() || t('profile');
  const displayEmail = String(draft.email || '').trim() || '-';
  const displayRole = String(draft.role || '').trim() || '-';
  const saveDisabled = !dirty || saving;

  return (
    <div className="ac-card overflow-hidden p-0">
      <div className="border-b border-[#e8edf3] bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fc_100%)] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--ac-brand)_0%,var(--ac-brand-deep)_100%)] text-lg font-semibold text-white shadow-[0_16px_30px_rgba(var(--ac-brand-rgb),0.22)]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">{title}</div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">{hint}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden rounded-2xl border border-[#e2e8f0] bg-white/90 px-4 py-3 text-sm text-zinc-600 shadow-[0_10px_24px_rgba(15,23,42,0.04)] lg:block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{t('accountAccess')}</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">{displayRole}</div>
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={saveDisabled}
              className="ac-btn min-w-[150px] px-4 py-2.5 sm:self-auto"
            >
              {saving ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </div>
      </div>

      {notice?.text ? (
        <div
          className={`mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm sm:mx-6 ${
            notice.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="px-5 py-5 sm:px-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-[#e5ebf1] bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
              <div className="mb-4">
                <div className="text-sm font-semibold text-zinc-900">{t('accountDetails')}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">{t('accountDetailsHint')}</div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('name')} error={errors?.name} htmlFor="profile-name">
                  <Input id="profile-name" value={draft.name} onChange={(v) => onChange({ name: v })} />
                </Field>

                <Field label={t('email')} error={errors?.email} hint={!canEditEmail ? t('onlyAdminsCanEditEmail') : ''} htmlFor="profile-email">
                  <Input id="profile-email" value={draft.email} onChange={(v) => onChange({ email: v })} disabled={!canEditEmail} type="email" />
                </Field>

                <Field label={t('role')} htmlFor="profile-role">
                  <Input id="profile-role" value={draft.role} onChange={() => {}} disabled />
                </Field>

                <Field label={t('accountAccess')} hint={t('accountAccessHint')} htmlFor="profile-access">
                  <Input id="profile-access" value={displayRole} onChange={() => {}} disabled />
                </Field>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#e5ebf1] bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
              <div className="mb-4">
                <div className="text-sm font-semibold text-zinc-900">{t('preferences')}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">{t('preferencesHint')}</div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t('displayLanguage')} hint={t('displayLanguageHint')} htmlFor="profile-language">
                  <Select id="profile-language" value={draft.language} onChange={(v) => onChange({ language: v })} options={languageOptions} />
                </Field>

                <div className="rounded-2xl border border-dashed border-[#dbe4ec] bg-[#f8fafc] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{t('profilePreview')}</div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900">{displayName}</div>
                  <div className="mt-1 text-sm text-zinc-600">{displayEmail}</div>
                  <div className="mt-3 inline-flex rounded-full border border-[rgba(var(--ac-brand-rgb),0.18)] bg-[rgba(var(--ac-brand-rgb),0.06)] px-3 py-1 text-xs font-semibold text-[rgb(var(--ac-brand-rgb))]">
                    {displayRole}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-[#e5ebf1] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{t('securitySettings')}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-500">{t('securitySettingsHint')}</div>
              </div>
              <div className="rounded-full border border-[#e2e8f0] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {t('password')}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#e8edf3] bg-white/80 px-4 py-4 text-sm leading-6 text-zinc-600">
              <div className="font-semibold text-zinc-900">{t('passwordSecurityTitle')}</div>
              <div className="mt-1">{t('passwordSecurityHint')}</div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label={t('newPassword')} error={errors?.newPassword} htmlFor="profile-new-password">
                <Input
                  id="profile-new-password"
                  value={draft.newPassword}
                  onChange={(v) => onChange({ newPassword: v })}
                  type="password"
                  placeholder={t('leaveBlankToKeepCurrentPassword')}
                  autoComplete="new-password"
                />
              </Field>

              <Field label={t('confirmNewPassword')} error={errors?.confirmNewPassword} htmlFor="profile-confirm-new-password">
                <Input
                  id="profile-confirm-new-password"
                  value={draft.confirmNewPassword}
                  onChange={(v) => onChange({ confirmNewPassword: v })}
                  type="password"
                  autoComplete="new-password"
                />
              </Field>

              {showCurrent ? (
                <Field label={t('currentPassword')} error={errors?.currentPassword} htmlFor="profile-current-password">
                  <Input
                    id="profile-current-password"
                    value={draft.currentPassword}
                    onChange={(v) => onChange({ currentPassword: v })}
                    type="password"
                    autoComplete="current-password"
                  />
                </Field>
              ) : null}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
