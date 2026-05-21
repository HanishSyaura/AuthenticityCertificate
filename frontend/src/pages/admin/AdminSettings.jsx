import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n/useT';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAdminSettingsStore from '../../store/useAdminSettingsStore';
import { createAdminApi } from '../../utils/adminApi';
import ProfileSettingsCard from '../../components/admin/settings/ProfileSettingsCard';
import SystemSettingsCard from '../../components/admin/settings/SystemSettingsCard';
import EmailSmtpSettingsCard from '../../components/admin/settings/EmailSmtpSettingsCard';
import { isFileTooLarge, MAX_UPLOAD_MB } from '../../utils/uploadLimits';

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

function parseRoleCsv(v) {
  const s = String(v || '').trim();
  if (!s) return [];
  return s
    .split(',')
    .map((x) => String(x || '').trim())
    .filter(Boolean);
}

function isValidRoleName(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[a-z][a-z0-9_.-]*$/.test(s);
}

export default function AdminSettings() {
  const { t } = useT();
  const { token, user, setToken, setUser } = useAdminAuthStore((s) => ({ token: s.token, user: s.user, setToken: s.setToken, setUser: s.setUser }));
  const { setSettingsResponse } = useAdminSettingsStore((s) => ({ setSettingsResponse: s.setSettingsResponse }));

  const role = user?.role || 'admin';
  const canEditEmail = role === 'super_admin' || role === 'admin';
  const canEditSystem = role === 'super_admin';

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const v = String(localStorage.getItem('ac_admin_settings_tab_v1') || '').trim();
      if (v === 'system' || v === 'email') return v;
      return 'profile';
    } catch {
      return 'profile';
    }
  });

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
    logoUrl: '',
    epcGeneratedEmailNotifyEnabled: false,
    epcGeneratedEmailNotifyRoles: '',
    epcProductionOrdersEmailNotifyEnabled: false,
    epcProductionOrdersEmailNotifyRoles: ''
  });
  const [systemDraft, setSystemDraft] = useState({
    organizationName: '',
    organizationCode: '',
    defaultLocale: 'en',
    defaultTimezone: 'Asia/Kuala_Lumpur',
    maintenanceMode: false,
    logoUrl: '',
    epcGeneratedEmailNotifyEnabled: false,
    epcGeneratedEmailNotifyRoles: '',
    epcProductionOrdersEmailNotifyEnabled: false,
    epcProductionOrdersEmailNotifyRoles: ''
  });
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemNotice, setSystemNotice] = useState({ kind: '', text: '' });
  const [systemErrors, setSystemErrors] = useState({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');

  const [smtpInitial, setSmtpInitial] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    smtpPassSet: false,
    smtpFrom: '',
    smtpReplyTo: ''
  });
  const [smtpDraft, setSmtpDraft] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    smtpPassSet: false,
    smtpFrom: '',
    smtpReplyTo: ''
  });
  const [smtpClearPassword, setSmtpClearPassword] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpNotice, setSmtpNotice] = useState({ kind: '', text: '' });
  const [smtpErrors, setSmtpErrors] = useState({});
  const [smtpTestDraft, setSmtpTestDraft] = useState({ to: '' });
  const [smtpTestErrors, setSmtpTestErrors] = useState({});
  const [smtpTestNotice, setSmtpTestNotice] = useState({ kind: '', text: '' });
  const [smtpTestSending, setSmtpTestSending] = useState(false);

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
          logoUrl: String(settings?.logoUrl || ''),
          epcGeneratedEmailNotifyEnabled: Boolean(settings?.epcGeneratedEmailNotifyEnabled),
          epcGeneratedEmailNotifyRoles: Array.isArray(settings?.epcGeneratedEmailNotifyRoles)
            ? settings.epcGeneratedEmailNotifyRoles.join(', ')
            : String(settings?.epcGeneratedEmailNotifyRoles || ''),
          epcProductionOrdersEmailNotifyEnabled: Boolean(settings?.epcProductionOrdersEmailNotifyEnabled),
          epcProductionOrdersEmailNotifyRoles: Array.isArray(settings?.epcProductionOrdersEmailNotifyRoles)
            ? settings.epcProductionOrdersEmailNotifyRoles.join(', ')
            : String(settings?.epcProductionOrdersEmailNotifyRoles || '')
        };
        setSystemInitial(s0);
        setSystemDraft(s0);
        setSettingsResponse({ organization: org || null, settings: settings || null });

        const smtp0 = {
          smtpHost: String(settings?.smtpHost || ''),
          smtpPort: String(settings?.smtpPort || '587'),
          smtpSecure: Boolean(settings?.smtpSecure),
          smtpUser: String(settings?.smtpUser || ''),
          smtpPass: '',
          smtpPassSet: Boolean(settings?.smtpPassSet),
          smtpFrom: String(settings?.smtpFrom || ''),
          smtpReplyTo: String(settings?.smtpReplyTo || '')
        };
        setSmtpInitial(smtp0);
        setSmtpDraft(smtp0);
        setSmtpClearPassword(false);
        setSmtpErrors({});
        setSmtpNotice({ kind: '', text: '' });
      } catch (e) {
        if (!mounted) return;
        const msg = e?.response?.data?.message || e?.message || t('failedToLoadSettings');
        setLoadError(String(msg));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [setSettingsResponse, t, token]);

  useEffect(() => {
    try {
      localStorage.setItem('ac_admin_settings_tab_v1', activeTab);
    } catch {
      void 0;
    }
  }, [activeTab]);

  function validateProfile(draft) {
    const errs = {};
    if (!String(draft.name || '').trim()) errs.name = t('nameRequired');
    if (canEditEmail) {
      if (!String(draft.email || '').trim()) errs.email = t('emailRequired');
      else if (!isValidEmail(draft.email)) errs.email = t('invalidEmailAddress');
    }

    const np = String(draft.newPassword || '');
    const cp = String(draft.confirmNewPassword || '');
    if (np.trim()) {
      if (np.length < 8) errs.newPassword = t('passwordMinLength', { min: 8 });
      if (!String(draft.currentPassword || '').trim()) errs.currentPassword = t('currentPasswordRequired');
      if (cp !== np) errs.confirmNewPassword = t('passwordsDoNotMatch');
    }
    return errs;
  }

  function validateSystem(draft) {
    const errs = {};
    if (!String(draft.organizationName || '').trim()) errs.organizationName = t('organizationNameRequired');
    const code = String(draft.organizationCode || '').trim();
    if (!code) errs.organizationCode = t('organizationCodeRequired');
    else if (!/^[A-Z0-9_-]+$/.test(code.toUpperCase())) errs.organizationCode = t('organizationCodeFormat');
    if (!String(draft.defaultLocale || '').trim()) errs.defaultLocale = t('localeRequired');
    if (!String(draft.defaultTimezone || '').trim()) errs.defaultTimezone = t('timezoneRequired');

    const genRoles = parseRoleCsv(draft.epcGeneratedEmailNotifyRoles);
    if (draft.epcGeneratedEmailNotifyEnabled) {
      if (genRoles.length === 0) errs.epcGeneratedEmailNotifyRoles = t('notificationRolesRequired');
    }
    if (genRoles.some((r) => !isValidRoleName(r))) errs.epcGeneratedEmailNotifyRoles = t('invalidRoleList');

    const prodRoles = parseRoleCsv(draft.epcProductionOrdersEmailNotifyRoles);
    if (draft.epcProductionOrdersEmailNotifyEnabled) {
      if (prodRoles.length === 0) errs.epcProductionOrdersEmailNotifyRoles = t('notificationRolesRequired');
    }
    if (prodRoles.some((r) => !isValidRoleName(r))) errs.epcProductionOrdersEmailNotifyRoles = t('invalidRoleList');

    return errs;
  }

  function validateSmtp(draft) {
    const errs = {};
    const host = String(draft.smtpHost || '').trim();
    const hasAny =
      host ||
      String(draft.smtpPort || '').trim() ||
      String(draft.smtpUser || '').trim() ||
      String(draft.smtpFrom || '').trim() ||
      String(draft.smtpReplyTo || '').trim() ||
      String(draft.smtpPass || '').trim() ||
      Boolean(draft.smtpSecure);

    if (!hasAny) return errs;

    if (!host) errs.smtpHost = t('required');
    const port = Number(String(draft.smtpPort || '').trim());
    if (!Number.isFinite(port) || port <= 0 || port > 65535) errs.smtpPort = t('invalidPort');

    const user = String(draft.smtpUser || '').trim();
    const from = String(draft.smtpFrom || '').trim();
    if (!from) errs.smtpFrom = t('required');
    else {
      const fromEmail = extractEmail(from);
      if (!isValidEmail(fromEmail)) errs.smtpFrom = t('invalidEmailAddress');
    }

    const reply = String(draft.smtpReplyTo || '').trim();
    if (reply) {
      const replyEmail = extractEmail(reply);
      if (!isValidEmail(replyEmail)) errs.smtpReplyTo = t('invalidEmailAddress');
    }

    const pass = String(draft.smtpPass || '');
    if (user && !pass.trim() && !draft.smtpPassSet && !smtpClearPassword) errs.smtpPass = t('required');
    return errs;
  }

  function validateSmtpTest(draft) {
    const errs = {};
    const to = String(draft.to || '').trim();
    if (!to) errs.to = t('emailRequired');
    else if (!isValidEmail(extractEmail(to))) errs.to = t('invalidEmailAddress');
    return errs;
  }

  function extractEmail(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    const m = s.match(/<([^<>]+)>/);
    if (m) return String(m[1] || '').trim();
    return s;
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
  const smtpDirty = useMemo(() => {
    if (smtpClearPassword) return true;
    const a = { ...smtpDraft, smtpPass: '' };
    const b = { ...smtpInitial, smtpPass: '' };
    return !shallowEqual(a, b) || Boolean(String(smtpDraft.smtpPass || '').trim());
  }, [smtpClearPassword, smtpDraft, smtpInitial]);

  const profileInvalid = Object.keys(validateProfile(profileDraft)).length > 0;
  const systemInvalid = Object.keys(validateSystem(systemDraft)).length > 0;
  const smtpInvalid = Object.keys(validateSmtp(smtpDraft)).length > 0;

  async function uploadLogo(file) {
    if (!file) return;
    setLogoUploadError('');
    setSystemNotice({ kind: '', text: '' });
    setLogoUploading(true);
    try {
      if (isFileTooLarge(file)) {
        throw new Error(t('fileTooLargeMaxMb', { mb: MAX_UPLOAD_MB }));
      }
      const api = createAdminApi({ token });
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/uploads/media', form, {
        timeout: 300_000
      });
      const created = res?.data?.data;
      const url = created?.url ? String(created.url) : '';
      if (!url) throw new Error(t('uploadResponseInvalid'));
      setSystemDraft((d) => ({ ...d, logoUrl: url }));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('logoUploadFailed');
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
      const nextToken = res?.data?.data?.token;
      if (nextToken) setToken(nextToken);
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
      setProfileNotice({ kind: 'success', text: t('profileUpdated') });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('failedToUpdateProfile');
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
        logoUrl: String(settings?.logoUrl || ''),
        epcGeneratedEmailNotifyEnabled: Boolean(settings?.epcGeneratedEmailNotifyEnabled),
        epcGeneratedEmailNotifyRoles: Array.isArray(settings?.epcGeneratedEmailNotifyRoles)
          ? settings.epcGeneratedEmailNotifyRoles.join(', ')
          : String(settings?.epcGeneratedEmailNotifyRoles || systemDraft.epcGeneratedEmailNotifyRoles || ''),
        epcProductionOrdersEmailNotifyEnabled: Boolean(settings?.epcProductionOrdersEmailNotifyEnabled),
        epcProductionOrdersEmailNotifyRoles: Array.isArray(settings?.epcProductionOrdersEmailNotifyRoles)
          ? settings.epcProductionOrdersEmailNotifyRoles.join(', ')
          : String(settings?.epcProductionOrdersEmailNotifyRoles || systemDraft.epcProductionOrdersEmailNotifyRoles || '')
      };
      setSystemInitial(next);
      setSystemDraft(next);
      setSystemErrors({});
      setSystemNotice({ kind: 'success', text: t('systemSettingsUpdated') });
      setLogoUploadError('');
      setSettingsResponse({ organization: org || null, settings: settings || null });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('failedToUpdateSystemSettings');
      setSystemNotice({ kind: 'error', text: String(msg) });
    } finally {
      setSystemSaving(false);
    }
  }

  async function saveSmtp() {
    const errs = validateSmtp(smtpDraft);
    setSmtpErrors(errs);
    setSmtpNotice({ kind: '', text: '' });
    if (Object.keys(errs).length > 0) return;

    const payload = {};
    const keys = ['smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpFrom', 'smtpReplyTo'];
    for (const k of keys) {
      if (smtpDraft[k] !== smtpInitial[k]) payload[k] = smtpDraft[k];
    }
    if (smtpClearPassword) payload.smtpPass = null;
    else if (String(smtpDraft.smtpPass || '').trim()) payload.smtpPass = String(smtpDraft.smtpPass);
    if (Object.keys(payload).length === 0) return;

    setSmtpSaving(true);
    try {
      const api = createAdminApi({ token });
      const res = await api.put('/settings', payload);
      const org = res?.data?.data?.organization;
      const settings = res?.data?.data?.settings;
      const next = {
        smtpHost: String(settings?.smtpHost || ''),
        smtpPort: String(settings?.smtpPort || '587'),
        smtpSecure: Boolean(settings?.smtpSecure),
        smtpUser: String(settings?.smtpUser || ''),
        smtpPass: '',
        smtpPassSet: Boolean(settings?.smtpPassSet),
        smtpFrom: String(settings?.smtpFrom || ''),
        smtpReplyTo: String(settings?.smtpReplyTo || '')
      };
      setSmtpInitial(next);
      setSmtpDraft(next);
      setSmtpClearPassword(false);
      setSmtpErrors({});
      setSmtpNotice({ kind: 'success', text: t('systemSettingsUpdated') });
      setSettingsResponse({ organization: org || null, settings: settings || null });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('failedToUpdateSystemSettings');
      setSmtpNotice({ kind: 'error', text: String(msg) });
    } finally {
      setSmtpSaving(false);
    }
  }

  async function sendSmtpTest() {
    const errs = validateSmtpTest(smtpTestDraft);
    setSmtpTestErrors(errs);
    setSmtpTestNotice({ kind: '', text: '' });
    if (Object.keys(errs).length > 0) return;
    setSmtpTestSending(true);
    try {
      const api = createAdminApi({ token });
      const res = await api.post('/settings/smtp/test', { to: extractEmail(smtpTestDraft.to) });
      if (res?.data?.success) setSmtpTestNotice({ kind: 'success', text: t('testEmailSent') });
      else setSmtpTestNotice({ kind: 'error', text: t('sendFailed') });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('sendFailed');
      setSmtpTestNotice({ kind: 'error', text: String(msg) });
    } finally {
      setSmtpTestSending(false);
    }
  }

  if (loading) {
    return (
      <div className="ac-page">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-2 text-base font-semibold text-zinc-900">{t('settings')}</div>
          <div className="text-sm text-zinc-600">{t('settingsHint')}</div>
          <div className="animate-pulse">
            <div className="h-4 w-40 rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-64 rounded bg-zinc-200" />
            <div className="mt-6 space-y-3">
              <div className="h-40 rounded-xl border border-zinc-200 bg-white" />
              <div className="h-40 rounded-xl border border-zinc-200 bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="ac-page">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-2 text-base font-semibold text-zinc-900">{t('settings')}</div>
          <div className="text-sm text-zinc-600">{t('settingsHint')}</div>
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page">
      <div className="mx-auto w-full max-w-5xl">
        <div className="ac-topbar">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">{t('settings')}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t('settingsHint')}</p>
            </div>
            <div className="inline-flex w-full flex-wrap rounded-xl border border-zinc-200/80 bg-white p-1 sm:w-auto">
              <button
                type="button"
                className={
                  activeTab === 'profile'
                    ? 'rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white'
                    : 'rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50'
                }
                onClick={() => setActiveTab('profile')}
              >
                {t('profileTab')}
              </button>
              <button
                type="button"
                className={
                  activeTab === 'system'
                    ? 'rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white'
                    : 'rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50'
                }
                onClick={() => setActiveTab('system')}
              >
                {t('systemTab')}
              </button>
              <button
                type="button"
                className={
                  activeTab === 'email'
                    ? 'rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white'
                    : 'rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50'
                }
                onClick={() => setActiveTab('email')}
              >
                {t('emailTab')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {activeTab === 'profile' ? (
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
          ) : null}

          {activeTab === 'system' ? (
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
          ) : null}

          {activeTab === 'email' ? (
            <EmailSmtpSettingsCard
              title={t('smtpSettings')}
              hint={t('smtpSettingsHint')}
              canEdit={canEditSystem}
              draft={smtpDraft}
              errors={smtpErrors}
              notice={smtpNotice}
              dirty={smtpDirty}
              invalid={smtpInvalid}
              saving={smtpSaving}
              testDraft={smtpTestDraft}
              testErrors={smtpTestErrors}
              testNotice={smtpTestNotice}
              testSending={smtpTestSending}
              onChange={(patch) => {
                setSmtpDraft((d) => ({ ...d, ...patch }));
                if (Object.prototype.hasOwnProperty.call(patch, 'smtpPass')) setSmtpClearPassword(false);
              }}
              onClearPassword={() => {
                setSmtpDraft((d) => ({ ...d, smtpPass: '' }));
                setSmtpClearPassword(true);
              }}
              onSave={saveSmtp}
              onChangeTest={(patch) => setSmtpTestDraft((d) => ({ ...d, ...patch }))}
              onSendTest={sendSmtpTest}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

