const prisma = require('../../config/prisma');

async function getOrganizationSettingsRow(organizationId) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;

  const rows = await prisma.$queryRaw`
    SELECT id, organizationId, defaultLocale, defaultTimezone, maintenanceMode, logoUrl, createdAt, updatedAt
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

  await prisma.$executeRaw`
    UPDATE OrganizationSettings
    SET
      defaultLocale = COALESCE(${defaultLocale}, defaultLocale),
      defaultTimezone = COALESCE(${defaultTimezone}, defaultTimezone),
      maintenanceMode = COALESCE(${maintenanceMode}, maintenanceMode),
      logoUrl = CASE WHEN ${hasLogoUrl} THEN ${logoUrl} ELSE logoUrl END,
      updatedAt = NOW()
    WHERE organizationId = ${orgId}
  `;

  return getOrganizationSettingsRow(orgId);
}

module.exports = {
  ensureOrganizationSettings,
  updateOrganizationSettings
};
