import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { createAdminApi } from '../../utils/adminApi';
import { useT } from '../../i18n/useT';

export default function AdminForceResetPassword() {
  const navigate = useNavigate();
  const { t } = useT();
  const token = useAdminAuthStore((s) => s.token);
  const user = useAdminAuthStore((s) => s.user);
  const fetchMe = useAdminAuthStore((s) => s.fetchMe);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ kind: '', text: '' });
  const [errors, setErrors] = useState({});

  const invalid = useMemo(() => {
    const next = {};
    if (!String(currentPassword || '').trim()) next.currentPassword = t('currentPasswordRequired');
    const np = String(newPassword || '');
    if (np.length < 8) next.newPassword = t('passwordMinLength', { min: 8 });
    if (String(confirmNewPassword || '') !== np) next.confirmNewPassword = t('passwordsDoNotMatch');
    return next;
  }, [confirmNewPassword, currentPassword, newPassword, t]);

  const mustReset = Boolean(user?.mustResetPassword);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-semibold text-zinc-900">{t('resetPassword')}</div>
          <div className="mt-1 text-xs text-zinc-500">{t('resetPasswordRequired')}</div>

          {notice?.text ? (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {notice.text}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-600">{t('currentPassword')}</div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              {errors?.currentPassword ? <div className="mt-1 text-xs text-red-600">{errors.currentPassword}</div> : null}
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-600">{t('newPassword')}</div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              {errors?.newPassword ? <div className="mt-1 text-xs text-red-600">{errors.newPassword}</div> : null}
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-600">{t('confirmNewPassword')}</div>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
              {errors?.confirmNewPassword ? <div className="mt-1 text-xs text-red-600">{errors.confirmNewPassword}</div> : null}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="ac-btn ac-btn-soft px-3 py-2 text-xs"
              disabled={mustReset}
              onClick={() => navigate('/admin/dashboard')}
            >
              {t('close')}
            </button>
            <button
              type="button"
              className="ac-btn px-3 py-2 text-xs"
              disabled={saving}
              onClick={async () => {
                if (!token) return;
                const errs = invalid;
                setErrors(errs);
                setNotice({ kind: '', text: '' });
                if (Object.keys(errs).length > 0) return;

                setSaving(true);
                try {
                  const api = createAdminApi({ token });
                  await api.patch('/auth/me', { currentPassword: String(currentPassword || ''), newPassword: String(newPassword || '') });
                  await fetchMe();
                  setNotice({ kind: 'success', text: t('profileUpdated') });
                  navigate('/admin/dashboard', { replace: true });
                } catch (e) {
                  const msg = e?.response?.data?.message || e?.message || t('failedToUpdateProfile');
                  setNotice({ kind: 'error', text: String(msg) });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

