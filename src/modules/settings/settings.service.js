const prisma = require('../../config/prisma');
const { encryptText } = require('../../utils/secretCrypto');

const EPC_GENERATED_EMAIL_KEY = 'epc_generated_email';
const EPC_PRODUCTION_ORDERS_EMAIL_KEY = 'epc_production_orders_email';

function normalizeRoleNames(roleNames) {
  const roles = Array.isArray(roleNames) ? roleNames : [];
  return Array.from(
    new Set(
      roles
        .map((r) => String(r || '').trim())
        .filter(Boolean)
        .slice(0, 50)
    )
  );
}

async function getNotificationConfig(organizationId, key) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;
  const k = String(key || '').trim();
  if (!k) return null;
  try {
    return await prisma.organizationNotificationConfig.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: k } }
    });
  } catch {
    return null;
  }
}

async function upsertNotificationConfig(organizationId, key, { isEnabled, roleNames } = {}) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;
  const k = String(key || '').trim();
  if (!k) return null;

  const cleanRoles = normalizeRoleNames(roleNames);
  const enabled = typeof isEnabled === 'boolean' ? isEnabled : cleanRoles.length > 0;
  try {
    return await prisma.organizationNotificationConfig.upsert({
      where: { organizationId_key: { organizationId: orgId, key: k } },
      create: {
        organizationId: orgId,
        key: k,
        isEnabled: enabled,
        roleNamesJson: cleanRoles
      },
      update: {
        isEnabled: enabled,
        roleNamesJson: cleanRoles
      }
    });
  } catch {
    return null;
  }
}

async function getOrganizationSettingsRow(organizationId) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      organizationId,
      defaultLocale,
      defaultTimezone,
      maintenanceMode,
      logoUrl,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassEnc,
      smtpFrom,
      smtpReplyTo,
      createdAt,
      updatedAt
    FROM OrganizationSettings
    WHERE organizationId = ${orgId}
    LIMIT 1
  `;

  return rows?.[0] || null;
}

async function ensureOrganizationSettings(organizationId) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;

  const existing = await getOrganizationSettingsRow(orgId);
  if (existing) return existing;

  await prisma.$executeRaw`
    INSERT INTO OrganizationSettings (organizationId, defaultLocale, defaultTimezone, maintenanceMode, createdAt, updatedAt)
    VALUES (${orgId}, 'en', 'Asia/Kuala_Lumpur', false, NOW(), NOW())
  `;

  return getOrganizationSettingsRow(orgId);
}

async function updateOrganizationSettings(organizationId, input) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;
  await ensureOrganizationSettings(orgId);

  const defaultLocale = typeof input.defaultLocale === 'string' ? input.defaultLocale.trim() : null;
  const defaultTimezone = typeof input.defaultTimezone === 'string' ? input.defaultTimezone.trim() : null;
  const maintenanceMode = typeof input.maintenanceMode === 'boolean' ? input.maintenanceMode : null;
  const hasLogoUrl = Object.prototype.hasOwnProperty.call(input, 'logoUrl');
  const logoUrl = typeof input.logoUrl === 'string' ? input.logoUrl.trim() : input.logoUrl === null ? null : null;

  const hasSmtpHost = Object.prototype.hasOwnProperty.call(input, 'smtpHost');
  const smtpHost = typeof input.smtpHost === 'string' ? input.smtpHost.trim() : input.smtpHost === null ? null : null;
  const hasSmtpPort = Object.prototype.hasOwnProperty.call(input, 'smtpPort');
  const smtpPort = Number.isFinite(Number(input.smtpPort)) ? Number(input.smtpPort) : input.smtpPort === null ? null : null;
  const hasSmtpSecure = Object.prototype.hasOwnProperty.call(input, 'smtpSecure');
  const smtpSecure = typeof input.smtpSecure === 'boolean' ? input.smtpSecure : input.smtpSecure === null ? null : null;
  const hasSmtpUser = Object.prototype.hasOwnProperty.call(input, 'smtpUser');
  const smtpUser = typeof input.smtpUser === 'string' ? input.smtpUser.trim() : input.smtpUser === null ? null : null;
  const hasSmtpPass = Object.prototype.hasOwnProperty.call(input, 'smtpPass');
  const smtpPassEnc =
    typeof input.smtpPass === 'string' ? encryptText(String(input.smtpPass)) : input.smtpPass === null ? null : null;
  const hasSmtpFrom = Object.prototype.hasOwnProperty.call(input, 'smtpFrom');
  const smtpFrom = typeof input.smtpFrom === 'string' ? input.smtpFrom.trim() : input.smtpFrom === null ? null : null;
  const hasSmtpReplyTo = Object.prototype.hasOwnProperty.call(input, 'smtpReplyTo');
  const smtpReplyTo = typeof input.smtpReplyTo === 'string' ? input.smtpReplyTo.trim() : input.smtpReplyTo === null ? null : null;

  await prisma.$executeRaw`
    UPDATE OrganizationSettings
    SET
      defaultLocale = COALESCE(${defaultLocale}, defaultLocale),
      defaultTimezone = COALESCE(${defaultTimezone}, defaultTimezone),
      maintenanceMode = COALESCE(${maintenanceMode}, maintenanceMode),
      logoUrl = CASE WHEN ${hasLogoUrl} THEN ${logoUrl} ELSE logoUrl END,
      smtpHost = CASE WHEN ${hasSmtpHost} THEN ${smtpHost} ELSE smtpHost END,
      smtpPort = CASE WHEN ${hasSmtpPort} THEN ${smtpPort} ELSE smtpPort END,
      smtpSecure = CASE WHEN ${hasSmtpSecure} THEN ${smtpSecure} ELSE smtpSecure END,
      smtpUser = CASE WHEN ${hasSmtpUser} THEN ${smtpUser} ELSE smtpUser END,
      smtpPassEnc = CASE WHEN ${hasSmtpPass} THEN ${smtpPassEnc} ELSE smtpPassEnc END,
      smtpFrom = CASE WHEN ${hasSmtpFrom} THEN ${smtpFrom} ELSE smtpFrom END,
      smtpReplyTo = CASE WHEN ${hasSmtpReplyTo} THEN ${smtpReplyTo} ELSE smtpReplyTo END,
      updatedAt = NOW()
    WHERE organizationId = ${orgId}
  `;

  return getOrganizationSettingsRow(orgId);
}

module.exports = {
  ensureOrganizationSettings,
  updateOrganizationSettings,
  EPC_GENERATED_EMAIL_KEY,
  EPC_PRODUCTION_ORDERS_EMAIL_KEY,
  getNotificationConfig,
  upsertNotificationConfig,
  getEpcGeneratedEmailConfig: async (organizationId) => await getNotificationConfig(organizationId, EPC_GENERATED_EMAIL_KEY),
  upsertEpcGeneratedEmailConfig: async (organizationId, input) =>
    await upsertNotificationConfig(organizationId, EPC_GENERATED_EMAIL_KEY, input),
  getEpcProductionOrdersEmailConfig: async (organizationId) =>
    await getNotificationConfig(organizationId, EPC_PRODUCTION_ORDERS_EMAIL_KEY),
  upsertEpcProductionOrdersEmailConfig: async (organizationId, input) =>
    await upsertNotificationConfig(organizationId, EPC_PRODUCTION_ORDERS_EMAIL_KEY, input)
};
