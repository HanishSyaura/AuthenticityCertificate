const prisma = require('../config/prisma');
const emailService = require('./email.service');
const settingsService = require('../modules/settings/settings.service');
const XLSX = require('xlsx');

function isValidEmail(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(v) {
  const s = String(v ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlTable(rows) {
  const clean = Array.isArray(rows) ? rows.filter((r) => r && r.value != null && String(r.value).trim()) : [];
  if (clean.length === 0) return '';
  const tr = clean
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;white-space:nowrap;">${escapeHtml(r.label)}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;margin:12px 0;">${tr}</table>`;
}

function buildEmailHtml({ title, intro, rows, linkLabel, linkUrl }) {
  const table = buildHtmlTable(rows);
  const safeTitle = escapeHtml(title || '');
  const safeIntro = escapeHtml(intro || '');
  const link =
    linkUrl && String(linkUrl).trim()
      ? `<div style="margin-top:14px;">
          <a href="${escapeHtml(linkUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:10px;">
            ${escapeHtml(linkLabel || 'Open')}
          </a>
        </div>
        <div style="margin-top:10px;font-size:12px;color:#6b7280;word-break:break-all;">
          ${escapeHtml(String(linkUrl))}
        </div>`
      : '';

  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111827;">
      <div style="max-width:640px;margin:0 auto;padding:18px;">
        <div style="font-size:18px;font-weight:700;margin-bottom:6px;">${safeTitle}</div>
        ${safeIntro ? `<div style="font-size:14px;color:#374151;margin-bottom:10px;">${safeIntro}</div>` : ''}
        ${table}
        ${link}
        <div style="margin-top:16px;font-size:12px;color:#6b7280;">This is an automated notification.</div>
      </div>
    </div>
  `.trim();
}

function formatTimestamp(d, timeZone) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const tz = String(timeZone || '').trim();
    const fmt = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      ...(tz ? { timeZone: tz } : {})
    });
    return fmt.format(date);
  } catch {
    return date.toISOString();
  }
}

async function buildEncodingXlsxAttachment({ organizationId, batchId }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(orgId) || orgId <= 0) return null;
  if (!Number.isFinite(id) || id <= 0) return null;

  const batch = await prisma.epcBatch.findFirst({
    where: { id, organizationId: orgId },
    include: { product: { select: { name: true } } }
  });
  if (!batch) return null;

  const items = await prisma.epcItem.findMany({
    where: { organizationId: orgId, batchId: id },
    orderBy: { runningNo: 'asc' },
    select: { epcCode: true }
  });

  const verifyUrlPrefix = (process.env.PUBLIC_VERIFY_URL_PREFIX || '').trim() || 'https://wmscertauth.clbgroups.com/verify?epc=';
  const rows = (items || []).map((it) => {
    const epcCode = String(it?.epcCode || '').trim();
    return {
      epcCode,
      url: epcCode ? `${verifyUrlPrefix}${encodeURIComponent(epcCode)}` : ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: ['epcCode', 'url'] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'encoding');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const safePart = (v, fallback) => String(v || fallback).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || fallback;
  const safeProduct = safePart(batch.product?.name, 'product');
  const safeBatch = safePart(batch.batchName, 'batch');
  const filename = `${safeProduct}_${safeBatch}_encoding.xlsx`;
  return { filename, contentBase64: Buffer.from(buffer).toString('base64'), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
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

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { code: true } });
  const batchName = String(batch?.batchName || batch?.name || '').trim() || `Batch #${batch?.id || ''}`.trim();
  const qty = Number(created) || Number(batch?.batchQty) || 0;
  const generatedAt = batch?.createdAt ? new Date(batch.createdAt) : new Date();
  let timeZone = null;
  try {
    const s = await settingsService.ensureOrganizationSettings(orgId);
    timeZone = s?.defaultTimezone || null;
  } catch {
  }

  const subject = `[${String(org?.code || 'ORG')}] EPC generated: ${batchName}`;
  const link = await buildAdminEpcLink(orgId);
  const lines = [
    'EPC batch generated.',
    `Batch: ${batchName}`,
    `Generated at: ${formatTimestamp(generatedAt, timeZone)}`,
    qty ? `Quantity: ${qty}` : null,
    startNo && endNo ? `Running no range: ${startNo} - ${endNo}` : null,
    link ? `Admin: ${link}` : null
  ].filter(Boolean);

  let attachment = null;
  try {
    attachment = await buildEncodingXlsxAttachment({ organizationId: orgId, batchId: batch?.id });
  } catch {
    attachment = null;
  }

  await emailService.sendEmail({
    organizationId: orgId,
    to,
    subject,
    text: lines.join('\n'),
    html: buildEmailHtml({
      title: subject,
      intro: 'EPC batch generated.',
      rows: [
        { label: 'Batch', value: batchName },
        { label: 'Generated at', value: formatTimestamp(generatedAt, timeZone) },
        ...(qty ? [{ label: 'Quantity', value: String(qty) }] : []),
        ...(startNo && endNo ? [{ label: 'Running no range', value: `${startNo} - ${endNo}` }] : [])
      ],
      linkLabel: 'Open Admin',
      linkUrl: link
    }),
    attachments: attachment ? [attachment] : undefined
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
    text: lines.join('\n'),
    html: buildEmailHtml({
      title: subject,
      intro: 'Production orders uploaded.',
      rows: [
        { label: 'Organization', value: String(org?.name || '') || String(org?.code || '') || String(orgId) },
        { label: 'Batch', value: batchName },
        ...(Number.isFinite(Number(rows)) ? [{ label: 'Rows', value: String(Number(rows)) }] : []),
        ...(Number.isFinite(Number(updated)) ? [{ label: 'Updated EPC items', value: String(Number(updated)) }] : [])
      ],
      linkLabel: 'Open Admin',
      linkUrl: link
    })
  });
}

module.exports = {
  resolveRecipientEmails,
  notifyEpcBatchGenerated,
  notifyProductionOrdersImported
};
