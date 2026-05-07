import React from 'react';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { hasPermission } from '../../utils/permissions';
import { useT } from '../../i18n/useT';

export default function AdminRequirePermission({ anyOf, title, children }) {
  const { t } = useT();
  const user = useAdminAuthStore((s) => s.user);
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const required = Array.isArray(anyOf) ? anyOf.filter(Boolean) : [];

  const allowed = required.length === 0 ? true : required.some((p) => hasPermission(permissions, p));

  if (!allowed) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold text-zinc-900">{title || t('accessDenied')}</div>
          <div className="mt-1 text-xs text-zinc-600">{t('accessDeniedHint')}</div>
        </div>
      </div>
    );
  }

  return children;
}
