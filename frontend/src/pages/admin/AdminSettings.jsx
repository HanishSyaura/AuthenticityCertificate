import React from 'react';
import { useT } from '../../i18n/useT';

export default function AdminSettings() {
  const { t } = useT();
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-2 text-base font-semibold text-zinc-900">{t('settings')}</div>
      <div className="text-sm text-zinc-600">{t('usersRoles')}</div>
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        <div className="font-semibold text-zinc-900">{t('profile')}</div>
        <div className="mt-1 text-xs text-zinc-500">{t('profileHint')}</div>
      </div>
      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        <div className="font-semibold text-zinc-900">{t('systemSettings')}</div>
        <div className="mt-1 text-xs text-zinc-500">{t('systemSettingsHint')}</div>
      </div>
    </div>
  );
}

