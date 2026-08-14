const { z } = require('zod');
const prisma = require('../../config/prisma');
const settingsService = require('./settings.service');
const emailService = require('../../services/email.service');

function isValidEmail(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function extractEmail(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/<([^<>]+)>/);
  if (m) return String(m[1] || '').trim();
  return s;
}

function isValidHttpUrl(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function getSettings(req, res) {
  try {
    const orgId = req.organization?.id;
    if (!orgId) return res.error('Organization required', 400);
    const row = await settingsService.ensureOrganizationSettings(orgId);
    const notifyCfg = await settingsService.getEpcGeneratedEmailConfig(orgId);
    const prodCfg = await settingsService.getEpcProductionOrdersEmailConfig(orgId);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    res.success(
      {
        organization: org
          ? {
              id: org.id,
              name: org.name,
              code: org.code
            }
          : null,
        settings: row
          ? {
              defaultLocale: row.defaultLocale,
              defaultTimezone: row.defaultTimezone,
              maintenanceMode: Boolean(row.maintenanceMode),
              appTitle: row.appTitle ? String(row.appTitle) : null,
              faviconUrl: row.faviconUrl ? String(row.faviconUrl) : null,
              logoUrl: row.logoUrl ? String(row.logoUrl) : null,
              smtpHost: row.smtpHost ? String(row.smtpHost) : null,
              smtpPort: row.smtpPort == null ? null : Number(row.smtpPort) || null,
              smtpSecure: row.smtpSecure == null ? null : Boolean(row.smtpSecure),
              smtpUser: row.smtpUser ? String(row.smtpUser) : null,
              smtpFromName: row.smtpFromName ? String(row.smtpFromName) : null,
              smtpFromEmail: row.smtpFromEmail ? String(row.smtpFromEmail) : null,
              smtpReplyTo: row.smtpReplyTo ? String(row.smtpReplyTo) : null,
              adminAppUrl: row.adminAppUrl ? String(row.adminAppUrl) : null,
              smtpPassSet: Boolean(row.smtpPassEnc),
              epcGeneratedEmailNotifyEnabled: Boolean(notifyCfg?.isEnabled),
              epcGeneratedEmailNotifyRoles: Array.isArray(notifyCfg?.roleNamesJson) ? notifyCfg.roleNamesJson : [],
              epcProductionOrdersEmailNotifyEnabled: Boolean(prodCfg?.isEnabled),
              epcProductionOrdersEmailNotifyRoles: Array.isArray(prodCfg?.roleNamesJson) ? prodCfg.roleNamesJson : []
            }
          : null
      },
      'OK'
    );
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.includes('does not exist') || msg.includes('Unknown column')) {
      console.error('[getSettings] Database schema mismatch: ' + msg);
      return res.error('System maintenance in progress. Please try again later.', 503);
    }
    if (e?.message === 'db_timeout') return res.error('Database temporarily unavailable', 503);
    res.error('Service temporarily unavailable', 503);
  }
}

const updateSchema = z.object({
  organizationName: z.string().trim().min(1).max(120).optional(),
  organizationCode: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Z0-9_\-]+$/)
    .optional(),
  defaultLocale: z.string().trim().min(2).max(20).optional(),
  defaultTimezone: z.string().trim().min(3).max(64).optional(),
  maintenanceMode: z.boolean().optional(),
  appTitle: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(191).nullable().optional()
  ),
  faviconUrl: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(512).nullable().optional()
  ),
  logoUrl: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(512).nullable().optional()
  ),
  smtpHost: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(191).nullable().optional()
  ),
  smtpPort: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : s;
    },
    z.number().int().min(1).max(65535).nullable().optional()
  ),
  smtpSecure: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v === 'boolean') return v;
      const s = String(v).trim().toLowerCase();
      if (!s) return null;
      if (s === '1' || s === 'true' || s === 'yes') return true;
      if (s === '0' || s === 'false' || s === 'no') return false;
      return v;
    },
    z.boolean().nullable().optional()
  ),
  smtpUser: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(191).nullable().optional()
  ),
  smtpPass: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v);
      return s.trim() ? s : null;
    },
    z.string().min(1).max(512).nullable().optional()
  ),
  smtpFromName: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(191).nullable().optional()
  ),
  smtpFromEmail: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(191).nullable().optional()
  ),
  smtpReplyTo: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(191).nullable().optional()
  ),
  adminAppUrl: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    },
    z.string().min(1).max(512).nullable().optional()
  ),
  epcGeneratedEmailNotifyEnabled: z.boolean().optional(),
  epcGeneratedEmailNotifyRoles: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return [];
      if (Array.isArray(v)) return v;
      const s = String(v || '').trim();
      if (!s) return [];
      return s
        .split(',')
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    },
    z
      .array(z.string().trim().min(2).max(64).regex(/^[a-z][a-z0-9_.-]*$/))
      .max(50)
      .optional()
  ),
  epcProductionOrdersEmailNotifyEnabled: z.boolean().optional(),
  epcProductionOrdersEmailNotifyRoles: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null) return [];
      if (Array.isArray(v)) return v;
      const s = String(v || '').trim();
      if (!s) return [];
      return s
        .split(',')
        .map((x) => String(x || '').trim())
        .filter(Boolean);
    },
    z
      .array(z.string().trim().min(2).max(64).regex(/^[a-z][a-z0-9_.-]*$/))
      .max(50)
      .optional()
  )
});

const smtpTestSchema = z.object({
  to: z.string().trim().min(3).max(320)
});

async function updateSettings(req, res) {
  try {
    const orgId = req.organization?.id;
    if (!orgId) return res.error('Organization required', 400);
    const validated = updateSchema.parse(req.body || {});

    if (validated.smtpFromEmail != null) {
      const fromEmail = extractEmail(validated.smtpFromEmail);
      if (!isValidEmail(fromEmail)) return res.error('Invalid From email', 400);
    }
    if (validated.smtpReplyTo != null) {
      const replyEmail = extractEmail(validated.smtpReplyTo);
      if (!isValidEmail(replyEmail)) return res.error('Invalid SMTP Reply-To address', 400);
    }
    if (validated.adminAppUrl != null && !isValidHttpUrl(validated.adminAppUrl)) {
      return res.error('Invalid Frontend URL', 400);
    }

    if (validated.organizationName || validated.organizationCode) {
      const data = {};
      if (validated.organizationName) data.name = validated.organizationName;
      if (validated.organizationCode) data.code = validated.organizationCode.toUpperCase();
      try {
        await prisma.organization.update({ where: { id: orgId }, data });
      } catch (e) {
        if (e?.code === 'P2002') return res.error('Organization code already in use', 400);
        throw e;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(validated, 'epcGeneratedEmailNotifyRoles') ||
      Object.prototype.hasOwnProperty.call(validated, 'epcGeneratedEmailNotifyEnabled')
    ) {
      const saved = await settingsService.upsertEpcGeneratedEmailConfig(orgId, {
        isEnabled: validated.epcGeneratedEmailNotifyEnabled,
        roleNames: validated.epcGeneratedEmailNotifyRoles
      });
      if (!saved) return res.error('Failed to save notification settings', 503);
    }

    if (
      Object.prototype.hasOwnProperty.call(validated, 'epcProductionOrdersEmailNotifyRoles') ||
      Object.prototype.hasOwnProperty.call(validated, 'epcProductionOrdersEmailNotifyEnabled')
    ) {
      const saved = await settingsService.upsertEpcProductionOrdersEmailConfig(orgId, {
        isEnabled: validated.epcProductionOrdersEmailNotifyEnabled,
        roleNames: validated.epcProductionOrdersEmailNotifyRoles
      });
      if (!saved) return res.error('Failed to save notification settings', 503);
    }

    const row = await settingsService.updateOrganizationSettings(orgId, validated);
    const notifyCfg = await settingsService.getEpcGeneratedEmailConfig(orgId);
    const prodCfg = await settingsService.getEpcProductionOrdersEmailConfig(orgId);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    res.success(
      {
        organization: org
          ? {
              id: org.id,
              name: org.name,
              code: org.code
            }
          : null,
        settings: row
          ? {
              defaultLocale: row.defaultLocale,
              defaultTimezone: row.defaultTimezone,
              maintenanceMode: Boolean(row.maintenanceMode),
              appTitle: row.appTitle ? String(row.appTitle) : null,
              faviconUrl: row.faviconUrl ? String(row.faviconUrl) : null,
              logoUrl: row.logoUrl ? String(row.logoUrl) : null,
              smtpHost: row.smtpHost ? String(row.smtpHost) : null,
              smtpPort: row.smtpPort == null ? null : Number(row.smtpPort) || null,
              smtpSecure: row.smtpSecure == null ? null : Boolean(row.smtpSecure),
              smtpUser: row.smtpUser ? String(row.smtpUser) : null,
              smtpFromName: row.smtpFromName ? String(row.smtpFromName) : null,
              smtpFromEmail: row.smtpFromEmail ? String(row.smtpFromEmail) : null,
              smtpReplyTo: row.smtpReplyTo ? String(row.smtpReplyTo) : null,
              adminAppUrl: row.adminAppUrl ? String(row.adminAppUrl) : null,
              smtpPassSet: Boolean(row.smtpPassEnc),
              epcGeneratedEmailNotifyEnabled: Boolean(notifyCfg?.isEnabled),
              epcGeneratedEmailNotifyRoles: Array.isArray(notifyCfg?.roleNamesJson) ? notifyCfg.roleNamesJson : [],
              epcProductionOrdersEmailNotifyEnabled: Boolean(prodCfg?.isEnabled),
              epcProductionOrdersEmailNotifyRoles: Array.isArray(prodCfg?.roleNamesJson) ? prodCfg.roleNamesJson : []
            }
          : null
      },
      'OK'
    );
  } catch (error) {
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return res.error(error.issues?.[0]?.message || error.errors?.[0]?.message || 'Invalid input', 400);
    }
    if (error?.message === 'db_timeout') {
      return res.error('Database temporarily unavailable', 503);
    }
    if (typeof error?.name === 'string' && error.name.startsWith('Prisma')) {
      return res.error('Database temporarily unavailable', 503);
    }
    res.error('Service temporarily unavailable', 503);
  }
}

async function listNotificationRoles(_req, res) {
  try {
    const enumRoles = ['super_admin', 'admin', 'operator'];
    const rows = await prisma.role.findMany({ orderBy: { name: 'asc' }, select: { name: true } });
    const names = rows.map((r) => String(r?.name || '').trim()).filter(Boolean);
    const all = Array.from(new Set([...enumRoles, ...names]));
    all.sort((a, b) => a.localeCompare(b));
    return res.success(all, 'OK');
  } catch {
    return res.success(['super_admin', 'admin', 'operator'], 'OK');
  }
}

async function sendSmtpTestEmail(req, res) {
  try {
    const orgId = req.organization?.id;
    if (!orgId) return res.error('Organization required', 400);
    const validated = smtpTestSchema.parse(req.body || {});
    const toEmail = extractEmail(validated.to);
    if (!isValidEmail(toEmail)) return res.error('Invalid email address', 400);

    const result = await emailService.sendEmailNow({
      organizationId: orgId,
      to: [toEmail],
      subject: 'SMTP test email',
      text: 'SMTP test email sent from Settings.'
    });
    if (result?.skipped && result.reason === 'smtp_not_configured') {
      return res.error('SMTP not configured', 400);
    }
    return res.success({ ok: Boolean(result?.ok), skipped: Boolean(result?.skipped), reason: result?.reason || null }, 'OK');
  } catch (error) {
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return res.error(error.issues?.[0]?.message || error.errors?.[0]?.message || 'Invalid input', 400);
    }
    const msg = String(error?.message || '');
    if (msg === 'nodemailer_missing') return res.error('Email service not available', 503);
    return res.error('Service temporarily unavailable', 503);
  }
}

module.exports = {
  getSettings,
  listNotificationRoles,
  updateSettings,
  sendSmtpTestEmail
};
