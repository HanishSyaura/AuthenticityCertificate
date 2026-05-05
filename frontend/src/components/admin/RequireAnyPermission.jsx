import React from 'react';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { hasPermission } from '../../utils/permissions';
import { useT } from '../../i18n/useT';

export default function RequireAnyPermission({ anyOf, children }) {
  const { t } = useT();
  const user = useAdminAuthStore((s) => s.user);

  if (!user) {
    return <div className="p-6 text-sm text-zinc-700">{t('loading')}</div>;
  }

  const role = user?.role || 'admin';
  const perms = user?.permissions || [];
  const required = Array.isArray(anyOf) ? anyOf : [anyOf].filter(Boolean);
  const allowed =
    role === 'super_admin' ||
    required.length === 0 ||
    required.some((p) => hasPermission(perms, p));

  if (!allowed) {
    return (
      <div className="p-6">
        <div className="text-base font-semibold text-zinc-900">{t('insufficientPermissions')}</div>
        <div className="mt-2 text-sm text-zinc-600">{t('insufficientPermissionsHint')}</div>
      </div>
    );
  }

  return children;
}

