import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n/useT';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAdminSettingsStore from '../../store/useAdminSettingsStore';
import { createAdminApi } from '../../utils/adminApi';
import ProfileSettingsCard from '../../components/admin/settings/ProfileSettingsCard';
import SystemSettingsCard from '../../components/admin/settings/SystemSettingsCard';

function shallowEqual(a, b) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function isValidEmail(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function AdminSettings() {
  const { t } = useT();
  const { token, user, setUser } = useAdminAuthStore((s) => ({ token: s.token, user: s.user, setUser: s.setUser }));
  const { setSettingsResponse } = useAdminSettingsStore((s) => ({ setSettingsResponse: s.setSettingsResponse }));

  const role = user?.role || 'admin';
  const canEditEmail = role === 'super_admin' || role === 'admin';
  const canEditSystem = role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [profileInitial, setProfileInitial] = useState({ name: '', email: '', role: '' });
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '', role: '', currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState({ kind: '', text: '' });
  const [profileErrors, setProfileErrors] = useState({});

  const [systemInitial, setSystemInitial] = useState({
    organizationName: '',
    organizationCode: '',
    defaultLocale: 'en',
    defaultTimezone: 'Asia/Kuala_Lumpur',
    maintenanceMode: false,
    logoUrl: ''
  });
  const [systemDraft, setSystemDraft] = useState({
    organizationName: '',
    organizationCode: '',
    defaultLocale: 'en',
    defaultTimezone: 'Asia/Kuala_Lumpur',
    maintenanceMode: false,
    logoUrl: ''
  });
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemNotice, setSystemNotice] = useState({ kind: '', text: '' });
  const [systemErrors, setSystemErrors] = useState({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');

  const localeOptions = useMemo(
    () => [
      { value: 'en', label: 'English (en)' },
      { value: 'ms', label: 'Bahasa Melayu (ms)' },
      { value: 'zh', label: '中文 (zh)' }
    ],
    []
  );
  const timezoneOptions = useMemo(
    () => [
      { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur' },
      { value: 'Asia/Singapore', label: 'Asia/Singapore' },
      { value: 'UTC', label: 'UTC' }
    ],
    []
  );

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');
      try {
        const api = createAdminApi({ token });
        const [meRes, settingsRes] = await Promise.all([api.get('/auth/me'), api.get('/settings')]);

        const me = meRes?.data?.data?.user;
        const org = settingsRes?.data?.data?.organization;
        const settings = settingsRes?.data?.data?.settings;

        if (!mounted) return;

        const p0 = {
          name: String(me?.name || ''),
          email: String(me?.email || ''),
          role: String(me?.role || 'admin')
        };
        setProfileInitial(p0);
        setProfileDraft((d) => ({
          ...d,
          name: p0.name,
          email: p0.email,
          role: p0.role,
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: ''
        }));

        const s0 = {
          organizationName: String(org?.name || ''),
          organizationCode: String(org?.code || ''),
          defaultLocale: String(settings?.defaultLocale || 'en'),
          defaultTimezone: String(settings?.defaultTimezone || 'Asia/Kuala_Lumpur'),
          maintenanceMode: Boolean(settings?.maintenanceMode),
          logoUrl: String(settings?.logoUrl || '')
        };
        setSystemInitial(s0);
        setSystemDraft(s0);
        setSettingsResponse({ organization: org || null, settings: settings || null });
      } catch (e) {
        if (!mounted) return;
        const msg = e?.response?.data?.message || e?.message || 'Failed to load settings';
        setLoadError(String(msg));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [token, setSettingsResponse]);

  function validateProfile(draft) {
    const errs = {};
    if (!String(draft.name || '').trim()) errs.name = 'Name is required';
    if (canEditEmail) {
      if (!String(draft.email || '').trim()) errs.email = 'Email is required';
      else if (!isValidEmail(draft.email)) errs.email = 'Invalid email address';
    }

    const np = String(draft.newPassword || '');
    const cp = String(draft.confirmNewPassword || '');
    if (np.trim()) {
      if (np.length < 8) errs.newPassword = 'Password must be at least 8 characters';
      if (!String(draft.currentPassword || '').trim()) errs.currentPassword = 'Current password is required';
      if (cp !== np) errs.confirmNewPassword = 'Passwords do not match';
    }
    return errs;
  }

  function validateSystem(draft) {
    const errs = {};
    if (!String(draft.organizationName || '').trim()) errs.organizationName = 'Organization name is required';
    const code = String(draft.organizationCode || '').trim();
    if (!code) errs.organizationCode = 'Organization code is required';
    else if (!/^[A-Z0-9_-]+$/.test(code.toUpperCase())) errs.organizationCode = 'Use A-Z, 0-9, underscore, or hyphen';
    if (!String(draft.defaultLocale || '').trim()) errs.defaultLocale = 'Locale is required';
    if (!String(draft.defaultTimezone || '').trim()) errs.defaultTimezone = 'Timezone is required';
    return errs;
  }

  const profileDirty = useMemo(() => {
    const baseChanged =
      String(profileDraft.name || '').trim() !== String(profileInitial.name || '').trim() ||
      String(profileDraft.email || '').trim() !== String(profileInitial.email || '').trim();
    const pwChanged =
      String(profileDraft.currentPassword || '').trim() ||
      String(profileDraft.newPassword || '').trim() ||
      String(profileDraft.confirmNewPassword || '').trim();
    return Boolean(baseChanged || pwChanged);
  }, [profileDraft, profileInitial]);

  const systemDirty = useMemo(() => !shallowEqual(systemDraft, systemInitial), [systemDraft, systemInitial]);

  const profileInvalid = Object.keys(validateProfile(profileDraft)).length > 0;
  const systemInvalid = Object.keys(validateSystem(systemDraft)).length > 0;

  async function uploadLogo(file) {
    if (!file) return;
    setLogoUploadError('');
    setSystemNotice({ kind: '', text: '' });
    setLogoUploading(true);
    try {
      const api = createAdminApi({ token });
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/uploads/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000
      });
      const created = res?.data?.data;
      const url = created?.url ? String(created.url) : '';
      if (!url) throw new Error('Upload response invalid');
      setSystemDraft((d) => ({ ...d, logoUrl: url }));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Logo upload failed';
      setLogoUploadError(String(msg));
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveProfile() {
    const errs = validateProfile(profileDraft);
    setProfileErrors(errs);
    setProfileNotice({ kind: '', text: '' });
    if (Object.keys(errs).length > 0) return;

    const payload = {};
    const nextName = String(profileDraft.name || '').trim();
    const nextEmail = String(profileDraft.email || '').trim();
    if (nextName !== String(profileInitial.name || '').trim()) payload.name = nextName;
    if (canEditEmail && nextEmail !== String(profileInitial.email || '').trim()) payload.email = nextEmail;
    if (String(profileDraft.newPassword || '').trim()) {
      payload.currentPassword = String(profileDraft.currentPassword || '');
      payload.newPassword = String(profileDraft.newPassword || '');
    }

    if (Object.keys(payload).length === 0) return;

    setProfileSaving(true);
    try {
      const api = createAdminApi({ token });
      const res = await api.patch('/auth/me', payload);
      const saved = res?.data?.data?.user;
      if (saved) setUser(saved);
      setProfileInitial({ name: String(saved?.name || nextName), email: String(saved?.email || nextEmail), role: String(saved?.role || role) });
      setProfileDraft((d) => ({
        ...d,
        name: String(saved?.name || nextName),
        email: String(saved?.email || nextEmail),
        role: String(saved?.role || role),
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
      setProfileErrors({});
      setProfileNotice({ kind: 'success', text: 'Profile updated' });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update profile';
      setProfileNotice({ kind: 'error', text: String(msg) });
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveSystem() {
    const errs = validateSystem(systemDraft);
    setSystemErrors(errs);
    setSystemNotice({ kind: '', text: '' });
    if (Object.keys(errs).length > 0) return;

    const payload = {};
    for (const k of Object.keys(systemDraft)) {
      if (systemDraft[k] !== systemInitial[k]) payload[k] = systemDraft[k];
    }
    if (Object.keys(payload).length === 0) return;

    setSystemSaving(true);
    try {
      const api = createAdminApi({ token });
      const res = await api.put('/settings', payload);
      const org = res?.data?.data?.organization;
      const settings = res?.data?.data?.settings;
      const next = {
        organizationName: String(org?.name || systemDraft.organizationName),
        organizationCode: String(org?.code || systemDraft.organizationCode),
        defaultLocale: String(settings?.defaultLocale || systemDraft.defaultLocale),
        defaultTimezone: String(settings?.defaultTimezone || systemDraft.defaultTimezone),
        maintenanceMode: Boolean(settings?.maintenanceMode),
        logoUrl: String(settings?.logoUrl || '')
      };
      setSystemInitial(next);
      setSystemDraft(next);
      setSystemErrors({});
      setSystemNotice({ kind: 'success', text: 'System settings updated' });
      setLogoUploadError('');
      setSettingsResponse({ organization: org || null, settings: settings || null });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update system settings';
      setSystemNotice({ kind: 'error', text: String(msg) });
    } finally {
      setSystemSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse">
          <div className="h-4 w-40 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-64 rounded bg-zinc-200" />
          <div className="mt-6 space-y-3">
            <div className="h-40 rounded-xl border border-zinc-200 bg-white" />
            <div className="h-40 rounded-xl border border-zinc-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-2 text-base font-semibold text-zinc-900">{t('settings')}</div>
        <div className="text-sm text-zinc-600">{t('systemSettingsHint')}</div>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-2 text-base font-semibold text-zinc-900">{t('settings')}</div>
      <div className="text-sm text-zinc-600">Manage your profile and system settings.</div>

      <div className="mt-6">
        <ProfileSettingsCard
          title={t('profile')}
          hint={t('profileHint')}
          canEditEmail={canEditEmail}
          draft={profileDraft}
          errors={profileErrors}
          notice={profileNotice}
          dirty={profileDirty}
          invalid={profileInvalid}
          saving={profileSaving}
          onChange={(patch) => setProfileDraft((d) => ({ ...d, ...patch }))}
          onSave={saveProfile}
        />
      </div>

      <div className="mt-4">
        <SystemSettingsCard
          title={t('systemSettings')}
          hint={t('systemSettingsHint')}
          canEdit={canEditSystem}
          draft={systemDraft}
          errors={systemErrors}
          notice={systemNotice}
          dirty={systemDirty}
          invalid={systemInvalid}
          saving={systemSaving}
          logoUploading={logoUploading}
          logoUploadError={logoUploadError}
          localeOptions={localeOptions}
          timezoneOptions={timezoneOptions}
          onChange={(patch) => setSystemDraft((d) => ({ ...d, ...patch }))}
          onUploadLogo={uploadLogo}
          onSave={saveSystem}
        />
      </div>
    </div>
  );
}

