const { z } = require('zod');
const prisma = require('../../config/prisma');
const settingsService = require('./settings.service');

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
              logoUrl: row.logoUrl ? String(row.logoUrl) : null,
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
  logoUrl: z.preprocess(
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

async function updateSettings(req, res) {
  try {
    const orgId = req.organization?.id;
    if (!orgId) return res.error('Organization required', 400);
    const validated = updateSchema.parse(req.body || {});

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
      await settingsService.upsertEpcGeneratedEmailConfig(orgId, {
        isEnabled: validated.epcGeneratedEmailNotifyEnabled,
        roleNames: validated.epcGeneratedEmailNotifyRoles
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(validated, 'epcProductionOrdersEmailNotifyRoles') ||
      Object.prototype.hasOwnProperty.call(validated, 'epcProductionOrdersEmailNotifyEnabled')
    ) {
      await settingsService.upsertEpcProductionOrdersEmailConfig(orgId, {
        isEnabled: validated.epcProductionOrdersEmailNotifyEnabled,
        roleNames: validated.epcProductionOrdersEmailNotifyRoles
      });
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
              logoUrl: row.logoUrl ? String(row.logoUrl) : null,
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
    if (error instanceof z.ZodError) {
      return res.error(error.errors[0].message, 400);
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

module.exports = {
  getSettings,
  updateSettings
};
