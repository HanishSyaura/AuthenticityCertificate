const prisma = require('../config/prisma');
const emailService = require('./email.service');
const settingsService = require('../modules/settings/settings.service');

function isValidEmail(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function splitEnumRoles(roleNames) {
  const enums = new Set(['super_admin', 'admin', 'operator']);
  const inEnum = [];
  for (const r of Array.isArray(roleNames) ? roleNames : []) {
    const s = String(r || '').trim();
    if (!s) continue;
    if (enums.has(s)) inEnum.push(s);
  }
  return Array.from(new Set(inEnum));
}

async function resolveRecipientEmails({ organizationId, roleNames }) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return [];
  const roles = Array.isArray(roleNames) ? roleNames.map((r) => String(r || '').trim()).filter(Boolean) : [];
  if (roles.length === 0) return [];

  const enumRoles = splitEnumRoles(roles);
  const clauses = [];
  clauses.push({ organizationId: orgId, roles: { some: { role: { name: { in: roles } } } } });
  if (enumRoles.length) {
    const nonSuper = enumRoles.filter((r) => r !== 'super_admin');
    if (nonSuper.length) clauses.push({ organizationId: orgId, role: { in: nonSuper } });
    if (enumRoles.includes('super_admin')) clauses.push({ role: 'super_admin', OR: [{ organizationId: orgId }, { organizationId: null }] });
  }

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: clauses
    },
    select: { email: true }
  });

  let admins = [];
  const includeAdmins = roles.includes('admin') || roles.includes('super_admin');
  if (includeAdmins) {
    try {
      admins = await prisma.admin.findMany({ select: { email: true } });
    } catch {
      admins = [];
    }
  }

  const emails = [...(users || []), ...(admins || [])]
    .map((u) => String(u?.email || '').trim())
    .filter((e) => isValidEmail(e));
  return Array.from(new Set(emails)).slice(0, 100);
}

async function adminBaseUrl(organizationId) {
  const orgId = Number(organizationId);
  if (Number.isFinite(orgId) && orgId > 0) {
    const row = await settingsService.ensureOrganizationSettings(orgId);
    const s = String(row?.adminAppUrl || '').trim();
    if (s) return s.replace(/\/+$/, '');
  }
  const s = String(process.env.ADMIN_APP_URL || process.env.APP_URL || '').trim();
  if (!s) return '';
  return s.replace(/\/+$/, '');
}

async function buildAdminEpcLink(organizationId) {
  const base = await adminBaseUrl(organizationId);
  if (!base) return '';
  return `${base}/admin/epc`;
}

async function notifyEpcBatchGenerated({ organizationId, batch, created, startNo, endNo } = {}) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return;
  const cfg = await settingsService.getEpcGeneratedEmailConfig(orgId);
  const enabled = Boolean(cfg?.isEnabled);
  const roles = Array.isArray(cfg?.roleNamesJson) ? cfg.roleNamesJson : [];
  if (!enabled || roles.length === 0) return;

  const to = await resolveRecipientEmails({ organizationId: orgId, roleNames: roles });
  if (to.length === 0) return;

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, code: true } });
  const batchName = String(batch?.batchName || batch?.name || '').trim() || `Batch #${batch?.id || ''}`.trim();
  const qty = Number(created) || Number(batch?.batchQty) || 0;

  const subject = `[${String(org?.code || 'ORG')}] EPC generated: ${batchName}`;
  const link = await buildAdminEpcLink(orgId);
  const lines = [
    'EPC batch generated.',
    `Organization: ${String(org?.name || '') || String(org?.code || '') || orgId}`,
    `Batch: ${batchName}`,
    qty ? `Quantity: ${qty}` : null,
    startNo && endNo ? `Running no range: ${startNo} - ${endNo}` : null,
    link ? `Admin: ${link}` : null
  ].filter(Boolean);

  await emailService.sendEmail({
    organizationId: orgId,
    to,
    subject,
    text: lines.join('\n')
  });
}

async function notifyProductionOrdersImported({ organizationId, batchId, rows, updated } = {}) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(orgId) || orgId <= 0) return;
  if (!Number.isFinite(id) || id <= 0) return;
  const cfg = await settingsService.getEpcProductionOrdersEmailConfig(orgId);
  const enabled = Boolean(cfg?.isEnabled);
  const roles = Array.isArray(cfg?.roleNamesJson) ? cfg.roleNamesJson : [];
  if (!enabled || roles.length === 0) return;

  const to = await resolveRecipientEmails({ organizationId: orgId, roleNames: roles });
  if (to.length === 0) return;

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, code: true } });
  const batch = await prisma.epcBatch.findFirst({ where: { id, organizationId: orgId }, select: { id: true, batchName: true } });
  const batchName = String(batch?.batchName || '').trim() || `Batch #${id}`;

  const subject = `[${String(org?.code || 'ORG')}] Production orders updated: ${batchName}`;
  const link = await buildAdminEpcLink(orgId);
  const lines = [
    'Production orders uploaded.',
    `Organization: ${String(org?.name || '') || String(org?.code || '') || orgId}`,
    `Batch: ${batchName}`,
    Number.isFinite(Number(rows)) ? `Rows: ${Number(rows)}` : null,
    Number.isFinite(Number(updated)) ? `Updated EPC items: ${Number(updated)}` : null,
    link ? `Admin: ${link}` : null
  ].filter(Boolean);

  await emailService.sendEmail({
    organizationId: orgId,
    to,
    subject,
    text: lines.join('\n')
  });
}

module.exports = {
  resolveRecipientEmails,
  notifyEpcBatchGenerated,
  notifyProductionOrdersImported
};
