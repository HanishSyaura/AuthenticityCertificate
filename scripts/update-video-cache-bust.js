require('dotenv').config();

const prisma = require('../src/config/prisma');

const TARGET_PATHS = [
  '/uploads/media/1/1784014930443-32e254b62787e9df713815d5c41882b4.mp4',
  '/uploads/media/1/1778210593254-1edb7228e1d9f562494ac0d265e7e905.mp4',
  '/uploads/media/1/1778220556763-50a4959688dd323114958ebd307580dd.mp4',
  '/uploads/media/1/1778223460765-883d2291a21dbe4133257235a4e37c49.mp4',
  '/uploads/media/1/1778222478774-66a2ee9af94b02186c7edd08393e9e06.mp4'
];

function normalizeVersion(raw) {
  const value = String(raw || '').trim();
  if (!value) return '20260715a';
  return value.replace(/[^A-Za-z0-9._-]/g, '');
}

function tryParseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return { url: new URL(raw), absolute: true };
  } catch {}
  try {
    return { url: new URL(raw, 'https://example.invalid'), absolute: false };
  } catch {
    return null;
  }
}

function maybeUpdateUrlString(value, version) {
  if (typeof value !== 'string') return { changed: false, value };
  const parsed = tryParseUrl(value);
  if (!parsed) return { changed: false, value };

  const pathname = parsed.url.pathname;
  if (!TARGET_PATHS.includes(pathname)) return { changed: false, value };

  parsed.url.searchParams.set('v', version);
  const next = parsed.absolute
    ? parsed.url.toString()
    : `${parsed.url.pathname}${parsed.url.search}${parsed.url.hash}`;
  return { changed: next !== value, value: next };
}

function updateJsonValue(node, version) {
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item) => {
      const res = updateJsonValue(item, version);
      if (res.changed) changed = true;
      return res.value;
    });
    return { changed, value: changed ? next : node };
  }

  if (node && typeof node === 'object') {
    let changed = false;
    const next = {};
    for (const [key, val] of Object.entries(node)) {
      const res =
        key === 'url'
          ? maybeUpdateUrlString(val, version)
          : updateJsonValue(val, version);
      if (res.changed) changed = true;
      next[key] = res.value;
    }
    return { changed, value: changed ? next : node };
  }

  return { changed: false, value: node };
}

async function updateJsonTable({ label, rows, field, update }) {
  let updated = 0;
  for (const row of rows) {
    const current = row[field];
    const res = updateJsonValue(current, VERSION);
    if (!res.changed) continue;
    await update(row.id, res.value);
    updated += 1;
    process.stdout.write(`[ok] ${label}#${row.id}\n`);
  }
  return updated;
}

async function updateMediaUrlTable({ label, rows, field, update }) {
  let updated = 0;
  for (const row of rows) {
    const res = maybeUpdateUrlString(row[field], VERSION);
    if (!res.changed) continue;
    await update(row.id, res.value);
    updated += 1;
    process.stdout.write(`[ok] ${label}#${row.id}\n`);
  }
  return updated;
}

function hasModel(name) {
  return prisma && typeof prisma[name] === 'object' && prisma[name] !== null;
}

const ORG_ID = Number(process.argv[2] || 1);
const VERSION = normalizeVersion(process.argv[3] || '20260715a');

async function main() {
  if (!Number.isFinite(ORG_ID) || ORG_ID <= 0) {
    throw new Error('Invalid organization id');
  }

  process.stdout.write(`Updating cache-bust version=${VERSION} for organizationId=${ORG_ID}\n`);

  const counts = {};
  if (hasModel('cmsLayout')) {
    const rows = await prisma.cmsLayout.findMany({ where: { organizationId: ORG_ID }, select: { id: true, layoutJson: true } });
    counts.cmsLayout = await updateJsonTable({
      label: 'CmsLayout',
      rows,
      field: 'layoutJson',
      update: (id, value) => prisma.cmsLayout.update({ where: { id }, data: { layoutJson: value } })
    });
  }
  if (hasModel('cmsVersion')) {
    const rows = await prisma.cmsVersion.findMany({ where: { organizationId: ORG_ID }, select: { id: true, layoutJson: true } });
    counts.cmsVersion = await updateJsonTable({
      label: 'CmsVersion',
      rows,
      field: 'layoutJson',
      update: (id, value) => prisma.cmsVersion.update({ where: { id }, data: { layoutJson: value } })
    });
  }
  if (hasModel('cmsTranslation')) {
    const rows = await prisma.cmsTranslation.findMany({ where: { organizationId: ORG_ID }, select: { id: true, contentJson: true } });
    counts.cmsTranslation = await updateJsonTable({
      label: 'CmsTranslation',
      rows,
      field: 'contentJson',
      update: (id, value) => prisma.cmsTranslation.update({ where: { id }, data: { contentJson: value } })
    });
  }
  if (hasModel('certificateTemplate')) {
    const rows = await prisma.certificateTemplate.findMany({ where: { organizationId: ORG_ID }, select: { id: true, layoutJson: true } });
    counts.certificateTemplate = await updateJsonTable({
      label: 'CertificateTemplate',
      rows,
      field: 'layoutJson',
      update: (id, value) => prisma.certificateTemplate.update({ where: { id }, data: { layoutJson: value } })
    });
  }
  if (hasModel('certificateTemplateTranslation')) {
    const rows = await prisma.certificateTemplateTranslation.findMany({ where: { organizationId: ORG_ID }, select: { id: true, layoutJson: true } });
    counts.certificateTemplateTranslation = await updateJsonTable({
      label: 'CertificateTemplateTranslation',
      rows,
      field: 'layoutJson',
      update: (id, value) => prisma.certificateTemplateTranslation.update({ where: { id }, data: { layoutJson: value } })
    });
  }
  if (hasModel('productSupportingCertificate')) {
    const rows = await prisma.productSupportingCertificate.findMany({ where: { organizationId: ORG_ID }, select: { id: true, mediaUrl: true } });
    counts.productSupportingCertificate = await updateMediaUrlTable({
      label: 'ProductSupportingCertificate',
      rows,
      field: 'mediaUrl',
      update: (id, value) => prisma.productSupportingCertificate.update({ where: { id }, data: { mediaUrl: value } })
    });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, organizationId: ORG_ID, version: VERSION, counts })}\n`);
}

main()
  .catch((err) => {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
  });
