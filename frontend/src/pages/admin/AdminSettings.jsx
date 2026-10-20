import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n/useT';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useAdminSettingsStore from '../../store/useAdminSettingsStore';
import useI18nStore from '../../store/useI18nStore';
import { createAdminApi } from '../../utils/adminApi';
import ProfileSettingsCard from '../../components/admin/settings/ProfileSettingsCard';
import BrandingSettingsCard from '../../components/admin/settings/BrandingSettingsCard';
import EmailSmtpSettingsCard from '../../components/admin/settings/EmailSmtpSettingsCard';
import { isFileTooLarge, MAX_UPLOAD_MB } from '../../utils/uploadLimits';
import { DEFAULT_THEME_PRIMARY_HEX, normalizeHexColor } from '../../utils/theme';
import { sanitizeBrandingText } from '../../utils/branding';

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
  const { lang, setLang } = useI18nStore((s) => ({ lang: s.lang, setLang: s.setLang }));

  const role = user?.role || 'admin';
  const canEditEmail = role === 'super_admin' || role === 'admin';
  const canEditSystem = role === 'super_admin';

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const v = String(localStorage.getItem('ac_admin_settings_tab_v1') || '').trim();
      if (v === 'branding' || v === 'email') return v;
      return 'profile';
    } catch {
      return 'profile';
    }
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [profileInitial, setProfileInitial] = useState({ name: '', email: '', role: '', language: 'en' });
  const [profileDraft, setProfileDraft] = useState({
    name: '',
    email: '',
    role: '',
    language: 'en',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState({ kind: '', text: '' });
  const [profileErrors, setProfileErrors] = useState({});

  const [brandingInitial, setBrandingInitial] = useState({
    organizationName: '',
    organizationCode: '',
    appTitle: '',
    loginHeroBadge: '',
    loginHeroTitle: '',
    loginHeroSubtitle: '',
    loginHeroHighlights: '',
    faviconUrl: '',
    logoUrl: '',
    themePrimaryHex: DEFAULT_THEME_PRIMARY_HEX
  });
  const [brandingDraft, setBrandingDraft] = useState({
    organizationName: '',
    organizationCode: '',
    appTitle: '',
    loginHeroBadge: '',
    loginHeroTitle: '',
    loginHeroSubtitle: '',
    loginHeroHighlights: '',
    faviconUrl: '',
    logoUrl: '',
    themePrimaryHex: DEFAULT_THEME_PRIMARY_HEX
  });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingNotice, setBrandingNotice] = useState({ kind: '', text: '' });
  const [brandingErrors, setBrandingErrors] = useState({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconUploadError, setFaviconUploadError] = useState('');

  const [smtpInitial, setSmtpInitial] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpPassSet: false,
    smtpFromName: '',
    smtpFromEmail: '',
    smtpReplyTo: '',
    adminAppUrl: '',
    epcGeneratedEmailNotifyEnabled: false,
    epcGeneratedEmailNotifyRoles: '',
    epcProductionOrdersEmailNotifyEnabled: false,
    epcProductionOrdersEmailNotifyRoles: ''
  });
  const [smtpDraft, setSmtpDraft] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpPassSet: false,
    smtpFromName: '',
    smtpFromEmail: '',
    smtpReplyTo: '',
    adminAppUrl: '',
    epcGeneratedEmailNotifyEnabled: false,
    epcGeneratedEmailNotifyRoles: '',
    epcProductionOrdersEmailNotifyEnabled: false,
    epcProductionOrdersEmailNotifyRoles: ''
  });
  const [smtpClearPassword, setSmtpClearPassword] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpNotice, setSmtpNotice] = useState({ kind: '', text: '' });
  const [smtpErrors, setSmtpErrors] = useState({});
  const [smtpTestDraft, setSmtpTestDraft] = useState({ to: '' });
  const [smtpTestErrors, setSmtpTestErrors] = useState({});
  const [smtpTestNotice, setSmtpTestNotice] = useState({ kind: '', text: '' });
  const [smtpTestSending, setSmtpTestSending] = useState(false);
  const [notificationRoleOptions, setNotificationRoleOptions] = useState([]);

  const tabItems = useMemo(
    () => [
      { key: 'profile', label: t('profileTab') },
      { key: 'branding', label: t('systemTab') },
      { key: 'email', label: t('emailTab') }
    ],
    [t]
  );

  const languageOptions = useMemo(
    () => [
      { value: 'en', label: 'English' },
      { value: 'ms', label: 'Bahasa Melayu' },
      { value: 'zh', label: '中文' }
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
        const [meRes, settingsRes, roleRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/settings/'),
          api.get('/settings/notification-roles').catch(() => null)
        ]);

        const me = meRes?.data?.data?.user;
        const org = settingsRes?.data?.data?.organization;
        const settings = settingsRes?.data?.data?.settings;
        const roles = Array.isArray(roleRes?.data?.data) ? roleRes.data.data : [];

        if (!mounted) return;

        const p0 = {
          name: String(me?.name || ''),
          email: String(me?.email || ''),
          role: String(me?.role || 'admin'),
          language: String(lang || 'en')
        };
        setProfileInitial(p0);
        setProfileDraft((d) => ({
          ...d,
          name: p0.name,
          email: p0.email,
          role: p0.role,
          language: p0.language,
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: ''
        }));

        const branding0 = {
          organizationName: sanitizeBrandingText(org?.name),
          organizationCode: sanitizeBrandingText(org?.code),
          appTitle: String(settings?.appTitle || ''),
          loginHeroBadge: String(settings?.loginHeroBadge || ''),
          loginHeroTitle: String(settings?.loginHeroTitle || ''),
          loginHeroSubtitle: String(settings?.loginHeroSubtitle || ''),
          loginHeroHighlights: Array.isArray(settings?.loginHeroHighlights) ? settings.loginHeroHighlights.join(', ') : String(settings?.loginHeroHighlights || ''),
          faviconUrl: String(settings?.faviconUrl || ''),
          logoUrl: String(settings?.logoUrl || ''),
          themePrimaryHex: normalizeHexColor(settings?.themePrimaryHex || DEFAULT_THEME_PRIMARY_HEX)
        };
        setBrandingInitial(branding0);
        setBrandingDraft(branding0);
        setSettingsResponse({ organization: org || null, settings: settings || null });

        const smtp0 = {
          smtpHost: String(settings?.smtpHost || ''),
          smtpPort: String(settings?.smtpPort || '587'),
          smtpUser: String(settings?.smtpUser || ''),
          smtpPass: '',
          smtpPassSet: Boolean(settings?.smtpPassSet),
          smtpFromName: String(settings?.smtpFromName || ''),
          smtpFromEmail: String(settings?.smtpFromEmail || ''),
          smtpReplyTo: String(settings?.smtpReplyTo || ''),
          adminAppUrl: String(settings?.adminAppUrl || ''),
          epcGeneratedEmailNotifyEnabled: Boolean(settings?.epcGeneratedEmailNotifyEnabled),
          epcGeneratedEmailNotifyRoles: Array.isArray(settings?.epcGeneratedEmailNotifyRoles)
            ? settings.epcGeneratedEmailNotifyRoles.join(', ')
            : String(settings?.epcGeneratedEmailNotifyRoles || ''),
          epcProductionOrdersEmailNotifyEnabled: Boolean(settings?.epcProductionOrdersEmailNotifyEnabled),
          epcProductionOrdersEmailNotifyRoles: Array.isArray(settings?.epcProductionOrdersEmailNotifyRoles)
            ? settings.epcProductionOrdersEmailNotifyRoles.join(', ')
            : String(settings?.epcProductionOrdersEmailNotifyRoles || '')
        };
        setSmtpInitial(smtp0);
        setSmtpDraft(smtp0);
        setSmtpClearPassword(false);
        setSmtpErrors({});
        setSmtpNotice({ kind: '', text: '' });
        setNotificationRoleOptions(Array.isArray(roles) ? roles.map((r) => String(r || '').trim()).filter(Boolean) : []);
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
  }, [lang, setSettingsResponse, t, token]);

  useEffect(() => {
    setProfileInitial((prev) => (prev.language === lang ? prev : { ...prev, language: lang }));
    setProfileDraft((prev) => (prev.language === lang ? prev : { ...prev, language: lang }));
  }, [lang]);

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

  function validateBranding(draft) {
    const errs = {};
    const code = String(draft.organizationCode || '').trim();
    if (code && !/^[A-Z0-9_-]+$/.test(code)) errs.organizationCode = t('organizationCodeFormat');
    if (!/^#[0-9a-f]{6}$/i.test(String(draft.themePrimaryHex || '').trim())) errs.themePrimaryHex = t('themePrimaryHexFormat');
    return errs;
  }

  function validateSmtp(draft) {
    const errs = {};
    const host = String(draft.smtpHost || '').trim();
    const hasAny =
      host ||
      String(draft.smtpPort || '').trim() ||
      String(draft.smtpUser || '').trim() ||
      String(draft.smtpFromName || '').trim() ||
      String(draft.smtpFromEmail || '').trim() ||
      String(draft.smtpReplyTo || '').trim() ||
      String(draft.adminAppUrl || '').trim() ||
      String(draft.smtpPass || '').trim();

    if (!hasAny) return errs;

    if (!host) errs.smtpHost = t('required');
    const port = Number(String(draft.smtpPort || '').trim());
    if (!Number.isFinite(port) || port <= 0 || port > 65535) errs.smtpPort = t('invalidPort');

    const user = String(draft.smtpUser || '').trim();
    const fromEmail = String(draft.smtpFromEmail || '').trim();
    if (!fromEmail) errs.smtpFromEmail = t('required');
    else if (!isValidEmail(extractEmail(fromEmail))) errs.smtpFromEmail = t('invalidEmailAddress');

    const reply = String(draft.smtpReplyTo || '').trim();
    if (reply) {
      const replyEmail = extractEmail(reply);
      if (!isValidEmail(replyEmail)) errs.smtpReplyTo = t('invalidEmailAddress');
    }

    const appUrl = String(draft.adminAppUrl || '').trim();
    if (appUrl) {
      try {
        const u = new URL(appUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') errs.adminAppUrl = t('invalidUrl');
      } catch {
        errs.adminAppUrl = t('invalidUrl');
      }
    }

    const pass = String(draft.smtpPass || '');
    if (user && !pass.trim() && !draft.smtpPassSet && !smtpClearPassword) errs.smtpPass = t('required');

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
      String(profileDraft.email || '').trim() !== String(profileInitial.email || '').trim() ||
      String(profileDraft.language || '').trim() !== String(profileInitial.language || '').trim();
    const pwChanged =
      String(profileDraft.currentPassword || '').trim() ||
      String(profileDraft.newPassword || '').trim() ||
      String(profileDraft.confirmNewPassword || '').trim();
    return Boolean(baseChanged || pwChanged);
  }, [profileDraft, profileInitial]);

  const brandingDirty = useMemo(() => !shallowEqual(brandingDraft, brandingInitial), [brandingDraft, brandingInitial]);
  const smtpDirty = useMemo(() => {
    if (smtpClearPassword) return true;
    const a = { ...smtpDraft, smtpPass: '' };
    const b = { ...smtpInitial, smtpPass: '' };
    return !shallowEqual(a, b) || Boolean(String(smtpDraft.smtpPass || '').trim());
  }, [smtpClearPassword, smtpDraft, smtpInitial]);

  const brandingInvalid = Object.keys(validateBranding(brandingDraft)).length > 0;
  const smtpInvalid = Object.keys(validateSmtp(smtpDraft)).length > 0;

  async function uploadLogo(file) {
    if (!file) return;
    setLogoUploadError('');
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
      setBrandingDraft((d) => ({ ...d, logoUrl: url }));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('logoUploadFailed');
      setLogoUploadError(String(msg));
    } finally {
      setLogoUploading(false);
    }
  }

  async function uploadFavicon(file) {
    if (!file) return;
    setFaviconUploadError('');
    setFaviconUploading(true);
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
      setBrandingDraft((d) => ({ ...d, faviconUrl: url }));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('faviconUploadFailed');
      setFaviconUploadError(String(msg));
    } finally {
      setFaviconUploading(false);
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
    const nextLanguage = String(profileDraft.language || 'en').trim() || 'en';
    if (nextName !== String(profileInitial.name || '').trim()) payload.name = nextName;
    if (canEditEmail && nextEmail !== String(profileInitial.email || '').trim()) payload.email = nextEmail;
    if (String(profileDraft.newPassword || '').trim()) {
      payload.currentPassword = String(profileDraft.currentPassword || '');
      payload.newPassword = String(profileDraft.newPassword || '');
    }

    const languageChanged = nextLanguage !== String(profileInitial.language || 'en').trim();
    if (Object.keys(payload).length === 0 && !languageChanged) return;

    setProfileSaving(true);
    try {
      let saved = null;
      if (Object.keys(payload).length > 0) {
        const api = createAdminApi({ token });
        const res = await api.patch('/auth/me', payload);
        saved = res?.data?.data?.user;
        const nextToken = res?.data?.data?.token;
        if (nextToken) setToken(nextToken);
        if (saved) setUser(saved);
      }
      if (languageChanged) setLang(nextLanguage);
      setProfileInitial({
        name: String(saved?.name || nextName),
        email: String(saved?.email || nextEmail),
        role: String(saved?.role || role),
        language: nextLanguage
      });
      setProfileDraft((d) => ({
        ...d,
        name: String(saved?.name || nextName),
        email: String(saved?.email || nextEmail),
        role: String(saved?.role || role),
        language: nextLanguage,
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

  async function saveBranding() {
    const errs = validateBranding(brandingDraft);
    setBrandingErrors(errs);
    setBrandingNotice({ kind: '', text: '' });
    if (Object.keys(errs).length > 0) return;

    const payload = {};
    for (const k of Object.keys(brandingDraft)) {
      if (brandingDraft[k] !== brandingInitial[k]) payload[k] = brandingDraft[k];
    }
    if (Object.keys(payload).length === 0) return;

    setBrandingSaving(true);
    try {
      const api = createAdminApi({ token });
      const res = await api.put('/settings', payload);
      const org = res?.data?.data?.organization;
      const settings = res?.data?.data?.settings;
      const next = {
        organizationName: sanitizeBrandingText(org?.name ?? brandingDraft.organizationName),
        organizationCode: sanitizeBrandingText(org?.code ?? brandingDraft.organizationCode),
        appTitle: String(settings?.appTitle || ''),
        loginHeroBadge: String(settings?.loginHeroBadge || ''),
        loginHeroTitle: String(settings?.loginHeroTitle || ''),
        loginHeroSubtitle: String(settings?.loginHeroSubtitle || ''),
        loginHeroHighlights: Array.isArray(settings?.loginHeroHighlights) ? settings.loginHeroHighlights.join(', ') : String(settings?.loginHeroHighlights || ''),
        faviconUrl: String(settings?.faviconUrl || ''),
        logoUrl: String(settings?.logoUrl || ''),
        themePrimaryHex: normalizeHexColor(settings?.themePrimaryHex || DEFAULT_THEME_PRIMARY_HEX)
      };
      setBrandingInitial(next);
      setBrandingDraft(next);
      setBrandingErrors({});
      setBrandingNotice({ kind: 'success', text: t('brandingSettingsUpdated') });
      setLogoUploadError('');
      setFaviconUploadError('');
      setSettingsResponse({ organization: org || null, settings: settings || null });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('failedToUpdateSystemSettings');
      setBrandingNotice({ kind: 'error', text: String(msg) });
    } finally {
      setBrandingSaving(false);
    }
  }

  async function saveSmtp() {
    const errs = validateSmtp(smtpDraft);
    setSmtpErrors(errs);
    setSmtpNotice({ kind: '', text: '' });
    if (Object.keys(errs).length > 0) return;

    const payload = {};
    const keys = [
      'smtpHost',
      'smtpPort',
      'smtpUser',
      'smtpFromName',
      'smtpFromEmail',
      'smtpReplyTo',
      'adminAppUrl',
      'epcGeneratedEmailNotifyEnabled',
      'epcGeneratedEmailNotifyRoles',
      'epcProductionOrdersEmailNotifyEnabled',
      'epcProductionOrdersEmailNotifyRoles'
    ];
    for (const k of keys) {
      if (smtpDraft[k] !== smtpInitial[k]) payload[k] = smtpDraft[k];
    }
    if (smtpClearPassword) payload.smtpPass = null;
    else if (String(smtpDraft.smtpPass || '').trim()) payload.smtpPass = String(smtpDraft.smtpPass);
    if (Object.keys(payload).length === 0) return;

    setSmtpSaving(true);
    try {
      const api = createAdminApi({ token });
      const res = await api.put('/settings/', payload);
      const org = res?.data?.data?.organization;
      const settings = res?.data?.data?.settings;
      const next = {
        smtpHost: String(settings?.smtpHost || ''),
        smtpPort: String(settings?.smtpPort || '587'),
        smtpUser: String(settings?.smtpUser || ''),
        smtpPass: '',
        smtpPassSet: Boolean(settings?.smtpPassSet),
        smtpFromName: String(settings?.smtpFromName || ''),
        smtpFromEmail: String(settings?.smtpFromEmail || ''),
        smtpReplyTo: String(settings?.smtpReplyTo || ''),
        adminAppUrl: String(settings?.adminAppUrl || ''),
        epcGeneratedEmailNotifyEnabled: Boolean(settings?.epcGeneratedEmailNotifyEnabled),
        epcGeneratedEmailNotifyRoles: Array.isArray(settings?.epcGeneratedEmailNotifyRoles)
          ? settings.epcGeneratedEmailNotifyRoles.join(', ')
          : String(settings?.epcGeneratedEmailNotifyRoles || smtpDraft.epcGeneratedEmailNotifyRoles || ''),
        epcProductionOrdersEmailNotifyEnabled: Boolean(settings?.epcProductionOrdersEmailNotifyEnabled),
        epcProductionOrdersEmailNotifyRoles: Array.isArray(settings?.epcProductionOrdersEmailNotifyRoles)
          ? settings.epcProductionOrdersEmailNotifyRoles.join(', ')
          : String(settings?.epcProductionOrdersEmailNotifyRoles || smtpDraft.epcProductionOrdersEmailNotifyRoles || '')
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
        <div className="mx-auto w-full max-w-[1480px]">
          <div className="rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.62)_100%)] p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="rounded-[26px] border border-[#dbe4ec] bg-[linear-gradient(135deg,#ffffff_0%,#f5f8fb_100%)] px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
                <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em] text-zinc-950">{t('settings')}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{t('settingsHint')}</p>
              </div>
              <div className="rounded-[26px] border border-[#dbe4ec] bg-white/90 p-2 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="h-11 animate-pulse rounded-2xl bg-zinc-200" />
                  <div className="h-11 animate-pulse rounded-2xl bg-zinc-200" />
                  <div className="h-11 animate-pulse rounded-2xl bg-zinc-200" />
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div className="h-72 animate-pulse rounded-[26px] border border-[#e5ebf1] bg-white/85 shadow-[0_16px_36px_rgba(15,23,42,0.04)]" />
              <div className="h-64 animate-pulse rounded-[26px] border border-[#e5ebf1] bg-white/85 shadow-[0_16px_36px_rgba(15,23,42,0.04)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="ac-page">
        <div className="mx-auto w-full max-w-[1480px]">
          <div className="rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.62)_100%)] p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-5">
            <div className="rounded-[26px] border border-[#dbe4ec] bg-[linear-gradient(135deg,#ffffff_0%,#f5f8fb_100%)] px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em] text-zinc-950">{t('settings')}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{t('settingsHint')}</p>
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page">
      <div className="mx-auto w-full max-w-[1480px]">
        <div className="rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.62)_100%)] p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="rounded-[26px] border border-[#dbe4ec] bg-[linear-gradient(135deg,#ffffff_0%,#f5f8fb_100%)] px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              <div className="min-w-0">
                <h2 className="text-[1.7rem] font-semibold tracking-[-0.03em] text-zinc-950">{t('settings')}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{t('settingsHint')}</p>
              </div>
            </div>
            <div className="rounded-[26px] border border-[#dbe4ec] bg-white/90 p-2 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tabItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={
                      activeTab === item.key
                        ? 'rounded-2xl border border-[rgba(var(--ac-brand-rgb),0.16)] bg-[linear-gradient(135deg,var(--ac-brand)_0%,var(--ac-brand-deep)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(var(--ac-brand-rgb),0.22)]'
                        : 'rounded-2xl border border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-zinc-600 transition hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
                    }
                    onClick={() => setActiveTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            {activeTab === 'profile' ? (
              <ProfileSettingsCard
                title={t('profile')}
                hint={t('profileHint')}
                canEditEmail={canEditEmail}
                draft={profileDraft}
                errors={profileErrors}
                notice={profileNotice}
                dirty={profileDirty}
                saving={profileSaving}
                languageOptions={languageOptions}
                onChange={(patch) => setProfileDraft((d) => ({ ...d, ...patch }))}
                onSave={saveProfile}
              />
            ) : null}

            {activeTab === 'branding' ? (
              <BrandingSettingsCard
                title={t('brandingContent')}
                hint={t('brandingContentHint')}
                canEdit={canEditSystem}
                draft={brandingDraft}
                errors={brandingErrors}
                notice={brandingNotice}
                dirty={brandingDirty}
                invalid={brandingInvalid}
                saving={brandingSaving}
                logoUploading={logoUploading}
                logoUploadError={logoUploadError}
                faviconUploading={faviconUploading}
                faviconUploadError={faviconUploadError}
                onChange={(patch) => setBrandingDraft((d) => ({ ...d, ...patch }))}
                onUploadLogo={uploadLogo}
                onUploadFavicon={uploadFavicon}
                onSave={saveBranding}
              />
            ) : null}

            {activeTab === 'email' ? (
              <EmailSmtpSettingsCard
                title={t('smtpSettings')}
                hint={t('smtpSettingsHint')}
                canEdit={canEditEmail}
                notificationRoleOptions={notificationRoleOptions}
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
    </div>
  );
}

