const prisma = require('../../config/prisma');
const XLSX = require('xlsx');
const { generateCertificateId, peekNextCertificateId, getCertificateDateKey } = require('../../utils/id-generator');
const { matchPermission } = require('../../middleware/access.middleware');
const settingsService = require('../settings/settings.service');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function getAllowedCorpPrefixes() {
  return ['DA01'];
}

function getRunningPadLen() {
  const n = Number(process.env.EPC_RUNNING_PAD || 8);
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.floor(n);
}

function getSkuLen() {
  const n = Number(process.env.EPC_SKU_LEN || 8);
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.floor(n);
}

function padRunningNo(n, len) {
  return String(n).padStart(len, '0');
}

function formatMMyy(d = new Date()) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear() % 100).padStart(2, '0');
  return `${month}${year}`;
}

function normalizeSkuCode(product) {
  const skuLen = getSkuLen();
  const rawSku = String(product?.sku || '').trim();
  const rawCode = String(product?.code || '').trim();
  const raw = rawSku || rawCode;

  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
  if (!cleaned) return '0'.repeat(skuLen);

  const m = cleaned.match(/^([A-Z]+)(\d+)$/);
  if (m) {
    const prefix = String(m[1] || '');
    const digits = String(m[2] || '');
    if (prefix.length >= skuLen) return prefix.slice(0, skuLen);
    const digitsLen = Math.max(0, skuLen - prefix.length);
    const d = digitsLen > 0 ? digits.slice(-digitsLen).padStart(digitsLen, '0') : '';
    return `${prefix}${d}`;
  }

  if (/^\d+$/.test(cleaned)) return cleaned.slice(-skuLen).padStart(skuLen, '0');
  if (cleaned.length >= skuLen) return cleaned.slice(0, skuLen);
  return cleaned.padEnd(skuLen, '0');
}

function buildEpcCode({ corpPrefix, runningNo, skuCode, mmyy }) {
  const padLen = getRunningPadLen();
  const run = padRunningNo(runningNo, padLen);
  return `${corpPrefix}${skuCode}${mmyy}${run}`;
}

function parseRunningNoFromEpcCode({ epcCode, corpPrefix }) {
  const code = String(epcCode || '').trim();
  const prefix = String(corpPrefix || '').trim();
  if (!code || !prefix) throw new Error('Invalid EPC code');
  if (!code.startsWith(prefix)) throw new Error(`EPC code does not start with ${prefix}`);

  const padLen = getRunningPadLen();
  const skuLen = getSkuLen();
  const expectedMinLen = prefix.length + skuLen + 4 + padLen;
  if (code.length < expectedMinLen) throw new Error('EPC code too short');

  const run = code.slice(code.length - padLen);
  if (!/^\d+$/.test(run)) throw new Error('Invalid running number in EPC code');

  const mmyy = code.slice(code.length - (padLen + 4), code.length - padLen);
  if (!/^\d{4}$/.test(mmyy)) throw new Error('Invalid MMYY in EPC code');
  const mm = Number(mmyy.slice(0, 2));
  if (!Number.isFinite(mm) || mm < 1 || mm > 12) throw new Error('Invalid month in EPC code');

  return BigInt(run);
}

function parseSkuCodeFromEpcCode({ epcCode, corpPrefix }) {
  const code = String(epcCode || '').trim();
  const prefix = String(corpPrefix || '').trim();
  if (!code || !prefix) throw new Error('Invalid EPC code');
  if (!code.startsWith(prefix)) throw new Error(`EPC code does not start with ${prefix}`);

  const padLen = getRunningPadLen();
  const skuLen = getSkuLen();
  const expectedMinLen = prefix.length + skuLen + 4 + padLen;
  if (code.length < expectedMinLen) throw new Error('EPC code too short');

  const skuCode = code.slice(prefix.length, prefix.length + skuLen);
  if (!/^[a-z0-9]+$/i.test(skuCode)) throw new Error('Invalid SKU code in EPC code');
  return skuCode.toUpperCase();
}

function looksLikeEpcCodeFormat(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!code) return false;
  if (!/^[A-Z0-9]+$/.test(code)) return false;
  const padLen = getRunningPadLen();
  const skuLen = getSkuLen();
  const prefixes = getAllowedCorpPrefixes();
  for (const p of prefixes) {
    const prefix = String(p || '').trim().toUpperCase();
    if (!prefix) continue;
    const expectedLen = prefix.length + skuLen + 4 + padLen;
    if (code.length !== expectedLen) continue;
    if (!code.startsWith(prefix)) continue;
    try {
      parseSkuCodeFromEpcCode({ epcCode: code, corpPrefix: prefix });
      parseRunningNoFromEpcCode({ epcCode: code, corpPrefix: prefix });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deleteAllBatches({ organizationId, corpPrefix }) {
  const orgId = Number(organizationId);
  const prefix = corpPrefix == null ? null : String(corpPrefix || '').trim();
  if (prefix) {
    const allowed = getAllowedCorpPrefixes();
    if (!allowed.includes(prefix)) throw new Error('Corp code tidak dibenarkan');
  }

  const result = await prisma.$transaction(async (tx) => {
    const batches = await tx.epcBatch.findMany({
      where: { organizationId: orgId, ...(prefix ? { corpPrefix: prefix } : {}) },
      select: { id: true, corpPrefix: true }
    });
    if (!batches.length) return { deletedBatches: 0, deletedItems: 0, corpPrefixes: prefix ? [prefix] : [] };

    const ids = batches.map((b) => Number(b.id)).filter((n) => Number.isFinite(n));
    const prefixes = Array.from(new Set(batches.map((b) => String(b.corpPrefix || '').trim()).filter((p) => p)));

    let deletedItems = 0;
    for (const group of chunkArray(ids, 1000)) {
      const res = await tx.epcItem.deleteMany({ where: { organizationId: orgId, batchId: { in: group } } });
      deletedItems += Number(res.count) || 0;
    }

    let deletedBatches = 0;
    for (const group of chunkArray(ids, 1000)) {
      const res = await tx.epcBatch.deleteMany({ where: { organizationId: orgId, id: { in: group } } });
      deletedBatches += Number(res.count) || 0;
    }

    if (prefixes.length) {
      await tx.corpSequence.deleteMany({
        where: { organizationId: orgId, corpPrefix: { in: prefixes } }
      });
    }

    return { deletedBatches, deletedItems, corpPrefixes: prefixes };
  });

  return {
    deletedBatches: Number(result.deletedBatches) || 0,
    deletedItems: Number(result.deletedItems) || 0,
    corpPrefixes: Array.isArray(result.corpPrefixes) ? result.corpPrefixes : []
  };
}

async function getNextCertificateId({ organizationId } = {}) {
  const orgId = Number(organizationId);
  let timeZone = null;
  if (Number.isFinite(orgId) && orgId > 0) {
    try {
      const settings = await settingsService.ensureOrganizationSettings(orgId);
      timeZone = settings?.defaultTimezone || null;
    } catch {
    }
  }
  return await prisma.$transaction(async (tx) => {
    return await generateCertificateId(tx, { timeZone });
  });
}

async function peekCertificateId({ organizationId } = {}) {
  const orgId = Number(organizationId);
  let timeZone = null;
  if (Number.isFinite(orgId) && orgId > 0) {
    try {
      const settings = await settingsService.ensureOrganizationSettings(orgId);
      timeZone = settings?.defaultTimezone || null;
    } catch {
    }
  }
  return await prisma.$transaction(async (tx) => {
    return await peekNextCertificateId(tx, { timeZone });
  });
}

async function resetTodayCertificateId({ organizationId } = {}) {
  const orgId = Number(organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) throw new Error('Invalid organization');

  let timeZone = null;
  try {
    const settings = await settingsService.ensureOrganizationSettings(orgId);
    timeZone = settings?.defaultTimezone || null;
  } catch {
  }

  const dateKey = getCertificateDateKey({ date: new Date(), timeZone });
  const prefix = 'CERT';
  const idPrefix = `${prefix}${dateKey}`;

  return await prisma.$transaction(async (tx) => {
    const exists = await tx.certificate.findFirst({
      where: { organizationId: orgId, certificateId: { startsWith: idPrefix } },
      orderBy: { createdAt: 'desc' },
      select: { certificateId: true, type: true, status: true, createdAt: true, batchId: true }
    });
    if (exists?.certificateId) {
      const info = [
        `id=${exists.certificateId}`,
        exists.type ? `type=${String(exists.type)}` : null,
        exists.status ? `status=${String(exists.status)}` : null,
        exists.batchId != null ? `batchId=${String(exists.batchId)}` : null,
        exists.createdAt ? `createdAt=${new Date(exists.createdAt).toISOString()}` : null
      ]
        .filter(Boolean)
        .join(', ');
      throw new Error(`Tak boleh reset: ada certificate untuk hari ini (${info})`);
    }

    await tx.certificateSequence.upsert({
      where: { dateKey },
      update: { lastNo: 0n },
      create: { dateKey, lastNo: 0n }
    });

    const nextId = await peekNextCertificateId(tx, { timeZone, prefix });
    return { dateKey, certificateId: nextId };
  });
}

async function generateEpcBatch({ organizationId, corpPrefix, productId, productionDate, batchName, batchQty, remark, certificateId, certificateTemplateId, templateData }) {
  const allowed = getAllowedCorpPrefixes();
  if (!allowed.includes(corpPrefix)) throw new Error('Corp code tidak dibenarkan');

  const orgId = Number(organizationId);
  const prodId = Number(productId);

  const product = await withTimeout(
    prisma.product.findFirst({ where: { id: prodId, organizationId: orgId } }),
    1200
  );
  if (!product) throw new Error('Product tidak dijumpai');
  const skuCode = normalizeSkuCode(product);
  const pd = productionDate ? toDateOrNull(productionDate) : null;
  if (productionDate && !pd) throw new Error('Invalid production date');
  const mmyy = formatMMyy(pd || new Date());
  let timeZone = null;
  try {
    const settings = await settingsService.ensureOrganizationSettings(orgId);
    timeZone = settings?.defaultTimezone || null;
  } catch {
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const appBatch = await tx.batch.upsert({
        where: { organizationId_batchNo: { organizationId: orgId, batchNo: batchName } },
        update: { productId: prodId },
        create: { organizationId: orgId, batchNo: batchName, productId: prodId },
        select: { id: true }
      });

      await tx.corpSequence.upsert({
        where: { organizationId_corpPrefix_skuCode: { organizationId: orgId, corpPrefix, skuCode } },
        update: {},
        create: { organizationId: orgId, corpPrefix, skuCode, lastNo: 0n }
      });

      const desiredCertIdRaw = String(certificateId || '').trim();
      const desiredCertId = desiredCertIdRaw ? desiredCertIdRaw.toUpperCase() : '';

      const batchCertId = desiredCertId || (await generateCertificateId(tx, { timeZone }));
      const existingCert = await tx.certificate.findUnique({
        where: { certificateId: batchCertId },
        select: { certificateId: true, organizationId: true }
      });
      if (existingCert) {
        if (Number(existingCert.organizationId) !== orgId) throw new Error('Certificate ID belongs to a different organization');
      } else {
        await tx.certificate.create({
          data: {
            certificateId: batchCertId,
            organizationId: orgId,
            type: 'shared',
            batchId: null,
            status: 'VALID',
            issuedAt: new Date()
          }
        });
      }

      const rows = await tx.$queryRaw`
        SELECT lastNo FROM \`CorpSequence\`
        WHERE organizationId = ${orgId} AND corpPrefix = ${corpPrefix} AND skuCode = ${skuCode}
        FOR UPDATE
      `;

      const current = rows && rows[0] && rows[0].lastNo !== undefined ? BigInt(rows[0].lastNo) : 0n;
      const maxExisting = await tx.epcItem.findFirst({
        where: { organizationId: orgId, epcCode: { startsWith: `${corpPrefix}${skuCode}` } },
        orderBy: { runningNo: 'desc' },
        select: { runningNo: true }
      });
      const maxExistingNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
      const baseNo = current > maxExistingNo ? current : maxExistingNo;
      const startNo = baseNo + 1n;
      const endNo = baseNo + BigInt(batchQty);
      await tx.corpSequence.update({
        where: { organizationId_corpPrefix_skuCode: { organizationId: orgId, corpPrefix, skuCode } },
        data: { lastNo: endNo }
      });

      const tplId = typeof certificateTemplateId === 'number' ? certificateTemplateId : null;
      if (tplId != null) {
        const tpl = await tx.certificateTemplate.findFirst({
          where: { id: tplId, organizationId: orgId, deletedAt: null, templateType: 'auth' },
          select: { id: true }
        });
        if (!tpl) throw new Error('Certificate template mesti jenis Auth');
      }

      const batch = await tx.epcBatch.create({
        data: {
          organizationId: orgId,
          corpPrefix,
          productId: prodId,
          sku: product.sku,
          batchName,
          batchQty,
          remark: remark || null,
          certificateId: batchCertId,
          certificateTemplateId: tplId,
          templateData: templateData || null,
          productionUploadedAt: null,
          productionDoneAt: null
        },
        include: {
          product: { select: { id: true, sku: true, name: true, code: true } },
          certificateTemplate: { select: { id: true, certificateId: true, name: true } }
        }
      });

      const items = [];
      for (let i = 0; i < batchQty; i += 1) {
        const runningNo = startNo + BigInt(i);
        const epcCode = buildEpcCode({ corpPrefix, runningNo: runningNo.toString(), skuCode, mmyy });
        items.push({
          organizationId: orgId,
          batchId: batch.id,
          epcCode,
          runningNo,
          netWeight: null,
          productionDate: pd || null,
          caiqNumber: null
        });
      }

      for (const c of chunkArray(items, 1000)) {
        await tx.epcItem.createMany({ data: c });
      }

      return { batch, created: batchQty, startNo: startNo.toString(), endNo: endNo.toString() };
    },
    { timeout: 12_000, maxWait: 5_000 }
  );

  return result;
}

async function importExistingEpc({ organizationId, productId, batchName, base64 }) {
  const orgId = Number(organizationId);
  const prodId = Number(productId);
  if (!Number.isFinite(prodId)) throw new Error('Invalid product');

  const corpPrefix = 'DA01';

  const product = await withTimeout(
    prisma.product.findFirst({ where: { id: prodId, organizationId: orgId } }),
    1200
  );
  if (!product) throw new Error('Product tidak dijumpai');
  let timeZone = null;
  try {
    const settings = await settingsService.ensureOrganizationSettings(orgId);
    timeZone = settings?.defaultTimezone || null;
  } catch {
  }

  const { rows } = parseXlsxBase64(base64);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Excel kosong');

  const items = [];
  let fileSkuCode = null;
  for (const r of rows) {
    const n = normalizeRowKeys(r);
    const epcCode = String(n.epccode || n.epc || n.code || '').trim();
    if (!epcCode) continue;
    const runningNo = parseRunningNoFromEpcCode({ epcCode, corpPrefix });
    const skuCode = parseSkuCodeFromEpcCode({ epcCode, corpPrefix });
    if (fileSkuCode == null) fileSkuCode = skuCode;
    if (fileSkuCode !== skuCode) throw new Error('Excel mengandungi SKU code berbeza; import perlu satu SKU sahaja');
    items.push({
      epcCode,
      runningNo
    });
  }
  if (items.length === 0) throw new Error('Tiada EPC code dalam Excel');
  if (!fileSkuCode) throw new Error('Tidak dapat baca SKU code dari EPC code');

  const name = String(batchName || '').trim() || `import_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.corpSequence.upsert({
      where: { organizationId_corpPrefix_skuCode: { organizationId: orgId, corpPrefix, skuCode: fileSkuCode } },
      update: {},
      create: { organizationId: orgId, corpPrefix, skuCode: fileSkuCode, lastNo: 0n }
    });

    const appBatch = await tx.batch.upsert({
      where: { organizationId_batchNo: { organizationId: orgId, batchNo: name } },
      update: { productId: prodId },
      create: { organizationId: orgId, batchNo: name, productId: prodId },
      select: { id: true }
    });

    const batchCertId = await generateCertificateId(tx, { timeZone });
    const existingCert = await tx.certificate.findUnique({ where: { certificateId: batchCertId }, select: { certificateId: true, organizationId: true } });
    if (existingCert) {
      if (Number(existingCert.organizationId) !== orgId) throw new Error('Certificate ID belongs to a different organization');
    } else {
      await tx.certificate.create({
        data: {
          certificateId: batchCertId,
          organizationId: orgId,
          type: 'shared',
          batchId: null,
          status: 'VALID',
          issuedAt: new Date()
        }
      });
    }

    const batch = await tx.epcBatch.create({
      data: {
        organizationId: orgId,
        corpPrefix,
        productId: prodId,
        sku: product.sku,
        batchName: name,
        batchQty: items.length,
        remark: 'import_existing',
        certificateId: batchCertId,
        certificateTemplateId: null,
        templateData: null,
        productionUploadedAt: null,
        productionDoneAt: null
      },
      include: {
        product: { select: { id: true, sku: true, name: true, code: true } },
        certificateTemplate: { select: { id: true, certificateId: true, name: true } }
      }
    });

    await tx.epcItem.createMany({
      data: items.map((it) => ({
        organizationId: orgId,
        batchId: batch.id,
        epcCode: it.epcCode,
        runningNo: it.runningNo,
        netWeight: null,
        productionDate: null,
        caiqNumber: null
      })),
      skipDuplicates: true
    });

    const rows2 = await tx.$queryRaw`
      SELECT lastNo FROM \`CorpSequence\`
      WHERE organizationId = ${orgId} AND corpPrefix = ${corpPrefix} AND skuCode = ${fileSkuCode}
      FOR UPDATE
    `;
    const current = rows2 && rows2[0] && rows2[0].lastNo !== undefined ? BigInt(rows2[0].lastNo) : 0n;
    const maxExisting = await tx.epcItem.findFirst({
      where: { organizationId: orgId, epcCode: { startsWith: `${corpPrefix}${fileSkuCode}` } },
      orderBy: { runningNo: 'desc' },
      select: { runningNo: true }
    });
    const maxExistingNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
    const nextLast = current > maxExistingNo ? current : maxExistingNo;
    await tx.corpSequence.update({
      where: { organizationId_corpPrefix_skuCode: { organizationId: orgId, corpPrefix, skuCode: fileSkuCode } },
      data: { lastNo: nextLast }
    });

    const inserted = await tx.epcItem.count({ where: { organizationId: orgId, batchId: batch.id } });
    return { batch, rows: items.length, inserted, lastNo: nextLast.toString() };
  });

  return result;
}

async function exportBatchXlsx({ organizationId, batchId, columns }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');

  const batch = await withTimeout(
    prisma.epcBatch.findFirst({
      where: { id, organizationId: orgId },
      include: {
        product: { select: { id: true, sku: true, name: true, code: true } },
        certificateTemplate: { select: { id: true, certificateId: true, name: true } }
      }
    }),
    2500
  );
  if (!batch) throw new Error('Batch tidak dijumpai');

  const items = await withTimeout(
    prisma.epcItem.findMany({
      where: { organizationId: orgId, batchId: id },
      orderBy: { runningNo: 'asc' },
      select: { epcCode: true, runningNo: true, createdAt: true, netWeight: true, productionDate: true, caiqNumber: true }
    }),
    12_000
  );

  const allowedColumns = new Set(['epcCode', 'runningNo', 'netWeight', 'productionDate', 'caiqNumber']);
  const requested = Array.isArray(columns) ? columns : [];
  const unique = [];
  for (const c of requested) {
    const key = String(c || '').trim();
    if (!key || !allowedColumns.has(key) || unique.includes(key)) continue;
    unique.push(key);
  }
  const exportColumns = unique.length > 0 ? unique : ['epcCode', 'netWeight', 'productionDate', 'caiqNumber'];

  const wsItems = XLSX.utils.json_to_sheet(
    items.map((it) => {
      const row = {};
      for (const col of exportColumns) {
        if (col === 'productionDate') {
          row[col] = it.productionDate ? new Date(it.productionDate).toISOString().slice(0, 10) : '';
          continue;
        }
        const v = it[col];
        row[col] = v == null ? '' : String(v);
      }
      return row;
    }),
    { header: exportColumns }
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsItems, 'epc');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const safePart = (v, fallback) => String(v || fallback).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || fallback;
  const safeProduct = safePart(batch.product?.name, 'product');
  const safeBatch = safePart(batch.batchName, 'batch');
  const safeQty = safePart(batch.batchQty, 'qty');
  const filename = `${safeProduct}_${safeBatch}_${safeQty}.xlsx`;
  return { buffer, filename };
}

async function exportBatchVerifyUrlXlsx({ organizationId, batchId, verifyUrlPrefix }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');

  const batch = await withTimeout(
    prisma.epcBatch.findFirst({
      where: { id, organizationId: orgId },
      include: {
        product: { select: { id: true, sku: true, name: true, code: true } },
        certificateTemplate: { select: { id: true, certificateId: true, name: true } }
      }
    }),
    2500
  );
  if (!batch) throw new Error('Batch tidak dijumpai');

  const items = await withTimeout(
    prisma.epcItem.findMany({
      where: { organizationId: orgId, batchId: id },
      orderBy: { runningNo: 'asc' },
      select: { epcCode: true }
    }),
    12_000
  );

  const prefix = String(verifyUrlPrefix || '').trim();
  const wsItems = XLSX.utils.json_to_sheet(
    items.map((it) => ({
      url: `${prefix}${encodeURIComponent(it.epcCode)}`
    })),
    { header: ['url'] }
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsItems, 'epc');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const safePart = (v, fallback) => String(v || fallback).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || fallback;
  const safeProduct = safePart(batch.product?.name, 'product');
  const safeBatch = safePart(batch.batchName, 'batch');
  const safeQty = safePart(batch.batchQty, 'qty');
  const filename = `${safeProduct}_${safeBatch}_${safeQty}_verify_urls.xlsx`;
  return { buffer, filename };
}

async function listBatches({ organizationId, q, limit, offset }) {
  const orgId = Number(organizationId);
  const where = {
    organizationId: orgId,
    ...(q
      ? {
          OR: [
            { batchName: { contains: q } },
            { corpPrefix: { contains: q } },
            { sku: { contains: q } },
            { product: { name: { contains: q } } },
            { product: { code: { contains: q } } }
          ]
        }
      : {})
  };

  const [total, items] = await withTimeout(
    Promise.all([
      prisma.epcBatch.count({ where }),
      prisma.epcBatch.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true, code: true } },
          certificateTemplate: { select: { id: true, certificateId: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
    ]),
    2500
  );

  return { items, total, limit, offset };
}

async function listItems({ organizationId, q, batchId, pendingOnly, limit, offset }) {
  const orgId = Number(organizationId);
  const where = {
    organizationId: orgId,
    ...(batchId ? { batchId: Number(batchId) } : {}),
    ...(pendingOnly
      ? {
          OR: [{ netWeight: null }, { netWeight: '' }]
        }
      : {}),
    ...(q
      ? {
          OR: [{ epcCode: { contains: q } }, { batch: { batchName: { contains: q } } }]
        }
      : {})
  };

  const [total, items] = await withTimeout(
    Promise.all([
      prisma.epcItem.count({ where }),
      prisma.epcItem.findMany({
        where,
        include: {
          batch: {
            select: {
              id: true,
              corpPrefix: true,
              batchName: true,
              batchQty: true,
              certificateId: true,
              sku: true,
              createdAt: true,
              product: { select: { id: true, sku: true, name: true, code: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
    ]),
    2500
  );

  return { items, total, limit, offset };
}

const EPC_ITEM_INCLUDE = {
  batch: {
    select: {
      id: true,
      corpPrefix: true,
      batchName: true,
      batchQty: true,
      certificateId: true,
      sku: true,
      createdAt: true,
      product: { select: { id: true, sku: true, name: true, code: true } }
    }
  }
};

async function getItemByEpc({ organizationId, epcCode }) {
  const orgId = Number(organizationId);
  const code = String(epcCode || '').trim();
  if (!code) throw new Error('EPC code required');

  const item = await withTimeout(
    prisma.epcItem.findUnique({
      where: { organizationId_epcCode: { organizationId: orgId, epcCode: code } },
      include: EPC_ITEM_INCLUDE
    }),
    1500
  );
  if (!item) {
    const err = new Error('EPC tidak dijumpai');
    err.status = 404;
    throw err;
  }
  return item;
}

function normalizeMaybeString(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function canOverrideItem({ actor }) {
  const role = String(actor?.role || '').trim();
  if (role === 'super_admin' || role === 'admin') return true;
  const perms = Array.isArray(actor?.permissions) ? actor.permissions : [];
  return matchPermission(perms, 'epc.override');
}

async function updateItemProduction({ organizationId, itemId, patch, actor, expectedBatchId }) {
  const orgId = Number(organizationId);
  const id = Number(itemId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('Invalid item id');
  const overrideAllowed = canOverrideItem({ actor });

  const existing = await withTimeout(
    prisma.epcItem.findFirst({ where: { id, organizationId: orgId }, include: EPC_ITEM_INCLUDE }),
    1500
  );
  if (!existing) {
    const err = new Error('EPC item tidak dijumpai');
    err.status = 404;
    throw err;
  }

  if (expectedBatchId != null) {
    const expected = Number(expectedBatchId);
    if (Number.isFinite(expected) && expected > 0 && Number(existing.batchId) !== expected) {
      const err = new Error('This EPC is recorded in the system, but it is not under the selected batch.');
      err.status = 409;
      throw err;
    }
  }

  const data = {};
  if (Object.prototype.hasOwnProperty.call(patch || {}, 'netWeight')) {
    const incoming = normalizeMaybeString(patch.netWeight);
    if (incoming != null && looksLikeEpcCodeFormat(incoming)) {
      const err = new Error('Scanned value looks like an EPC code. Please scan Net Weight instead of EPC.');
      err.status = 400;
      throw err;
    }
    const prev = normalizeMaybeString(existing.netWeight);
    if (incoming == null) {
      if (prev != null && !overrideAllowed) {
        const err = new Error('Net weight sudah diisi. Perlukan kebenaran admin untuk ubah.');
        err.status = 409;
        throw err;
      }
      data.netWeight = null;
    } else if (prev == null || prev === incoming) {
      data.netWeight = incoming;
    } else if (!overrideAllowed) {
      const err = new Error('Net weight sudah diisi. Perlukan kebenaran admin untuk ubah.');
      err.status = 409;
      throw err;
    } else {
      data.netWeight = incoming;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch || {}, 'caiqNumber')) {
    const incoming = normalizeMaybeString(patch.caiqNumber);
    if (incoming != null && looksLikeEpcCodeFormat(incoming)) {
      const err = new Error('Scanned value looks like an EPC code. Please scan CAIQ instead of EPC.');
      err.status = 400;
      throw err;
    }
    const prev = normalizeMaybeString(existing.caiqNumber);
    if (incoming == null) {
      if (prev != null && !overrideAllowed) {
        const err = new Error('CAIQ sudah diisi. Perlukan kebenaran admin untuk ubah.');
        err.status = 409;
        throw err;
      }
      data.caiqNumber = null;
    } else if (prev == null || prev === incoming) {
      data.caiqNumber = incoming;
    } else if (!overrideAllowed) {
      const err = new Error('CAIQ sudah diisi. Perlukan kebenaran admin untuk ubah.');
      err.status = 409;
      throw err;
    } else {
      data.caiqNumber = incoming;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch || {}, 'productionDate')) {
    const incoming = patch.productionDate == null ? null : patch.productionDate;
    const prev = existing.productionDate || null;
    if (incoming == null) {
      if (prev != null && !overrideAllowed) {
        const err = new Error('Production date sudah diisi. Perlukan kebenaran admin untuk ubah.');
        err.status = 409;
        throw err;
      }
      data.productionDate = null;
    } else if (prev == null || (incoming instanceof Date && prev.getTime() === incoming.getTime())) {
      data.productionDate = incoming;
    } else if (!overrideAllowed) {
      const err = new Error('Production date sudah diisi. Perlukan kebenaran admin untuk ubah.');
      err.status = 409;
      throw err;
    } else {
      data.productionDate = incoming;
    }
  }

  if (Object.keys(data).length === 0) return existing;

  const updated = await withTimeout(prisma.epcItem.update({ where: { id }, data, include: EPC_ITEM_INCLUDE }), 1500);
  return updated;
}

async function resetItemsProduction({ organizationId, itemIds, actor }) {
  const orgId = Number(organizationId);
  const ids = Array.isArray(itemIds) ? itemIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0) : [];
  if (ids.length === 0) throw new Error('No item ids');
  if (!canOverrideItem({ actor })) {
    const err = new Error('Tiada kebenaran untuk reset data produksi.');
    err.status = 403;
    throw err;
  }

  const res = await withTimeout(
    prisma.epcItem.updateMany({
      where: { organizationId: orgId, id: { in: ids } },
      data: { netWeight: null, caiqNumber: null }
    }),
    1500
  );
  return { updatedCount: Number(res?.count) || 0 };
}

function parseXlsxBase64(base64) {
  const raw = String(base64 || '');
  const commaIdx = raw.indexOf(',');
  const b64 = commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
  const buf = Buffer.from(b64, 'base64');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames?.find((n) => String(n || '').toLowerCase() === 'epc') || wb.SheetNames?.[0] || null;
  if (!sheetName) return { sheetName: null, rows: [] };
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return { sheetName, rows };
}

function normalizeRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    const key = String(k || '').trim().toLowerCase().replace(/\s+/g, '');
    out[key] = v;
  }
  return out;
}

function toDateOrNull(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  if (typeof input === 'number') {
    const d = XLSX.SSF.parse_date_code(input);
    if (d && d.y && d.m && d.d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(input || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

async function importProductionXlsx({ organizationId, batchId, base64 }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');
  const { rows } = parseXlsxBase64(base64);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Excel kosong');

  const updates = [];
  for (const r of rows) {
    const n = normalizeRowKeys(r);
    const epcCode = String(n.epccode || n.epc || n.code || '').trim();
    if (!epcCode) continue;
    updates.push({
      epcCode,
      netWeight: String(n.netweight || n.net_weight || '').trim() || null,
      productionDate: toDateOrNull(n.productiondate || n.dateofproduction || n.production_date),
      caiqNumber: String(n.caiqnumber || n.caiq || n.caiqlabel || n.caiq_label || '').trim() || null
    });
  }
  if (updates.length === 0) throw new Error('Tiada EPC code dalam Excel');

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.epcBatch.findFirst({ where: { id, organizationId: orgId } });
    if (!batch) throw new Error('Batch tidak dijumpai');

    let updated = 0;
    for (const u of updates) {
      const res = await tx.epcItem.updateMany({
        where: { organizationId: orgId, batchId: id, epcCode: u.epcCode },
        data: { netWeight: u.netWeight, productionDate: u.productionDate, caiqNumber: u.caiqNumber }
      });
      updated += res.count || 0;
    }

    await tx.epcBatch.update({ where: { id }, data: { productionUploadedAt: new Date() } });
    return { batchId: id, rows: updates.length, updated };
  });

  return result;
}

async function markProductionDone({ organizationId, batchId }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');
  const res = await withTimeout(
    prisma.epcBatch.updateMany({
      where: { id, organizationId: orgId },
      data: { productionDoneAt: new Date() }
    }),
    1500
  );
  if (!res.count) throw new Error('Batch tidak dijumpai');
  return { batchId: id };
}

async function deleteBatch({ organizationId, batchId }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');
  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.epcBatch.findFirst({ where: { id, organizationId: orgId } });
    if (!batch) throw new Error('Batch tidak dijumpai');
    const corpPrefix = String(batch.corpPrefix || '').trim();
    const skuCode = normalizeSkuCode({ sku: batch.sku || '' });
    await tx.epcItem.deleteMany({ where: { organizationId: orgId, batchId: id } });
    await tx.epcBatch.delete({ where: { id } });
    if (corpPrefix && skuCode) {
      await tx.corpSequence.upsert({
        where: { organizationId_corpPrefix_skuCode: { organizationId: orgId, corpPrefix, skuCode } },
        update: {},
        create: { organizationId: orgId, corpPrefix, skuCode, lastNo: 0n }
      });
      const maxExisting = await tx.epcItem.findFirst({
        where: { organizationId: orgId, epcCode: { startsWith: `${corpPrefix}${skuCode}` } },
        orderBy: { runningNo: 'desc' },
        select: { runningNo: true }
      });
      const nextLastNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
      await tx.corpSequence.update({
        where: { organizationId_corpPrefix_skuCode: { organizationId: orgId, corpPrefix, skuCode } },
        data: { lastNo: nextLastNo }
      });
    }
    return { batchId: id, corpPrefix: batch.corpPrefix };
  });
  return result;
}

async function recalculateCorpSequence({ organizationId, corpPrefix }) {
  const orgId = Number(organizationId);
  const prefix = String(corpPrefix || '').trim();
  if (!prefix) throw new Error('corpPrefix required');
  const allowed = getAllowedCorpPrefixes();
  if (!allowed.includes(prefix)) throw new Error('Corp code tidak dibenarkan');

  const result = await prisma.$transaction(async (tx) => {
    await tx.corpSequence.deleteMany({ where: { organizationId: orgId, corpPrefix: prefix } });

    const skuLen = getSkuLen();
    const prefixLen = prefix.length;
    const bySku = await tx.$queryRaw`
      SELECT
        UPPER(SUBSTRING(epcCode, ${prefixLen + 1}, ${skuLen})) AS skuCode,
        MAX(runningNo) AS maxNo
      FROM \`EpcItem\`
      WHERE organizationId = ${orgId}
        AND epcCode LIKE ${`${prefix}%`}
      GROUP BY UPPER(SUBSTRING(epcCode, ${prefixLen + 1}, ${skuLen}))
    `;

    let overallMax = 0n;
    for (const r of Array.isArray(bySku) ? bySku : []) {
      const skuCode = String(r.skuCode || '').trim().toUpperCase();
      const maxNo = r.maxNo != null ? BigInt(r.maxNo) : 0n;
      if (!skuCode) continue;
      if (maxNo > overallMax) overallMax = maxNo;
      await tx.corpSequence.upsert({
        where: { organizationId_corpPrefix_skuCode: { organizationId: orgId, corpPrefix: prefix, skuCode } },
        update: { lastNo: maxNo },
        create: { organizationId: orgId, corpPrefix: prefix, skuCode, lastNo: maxNo }
      });
    }

    return { corpPrefix: prefix, lastNo: overallMax, updatedSkus: Array.isArray(bySku) ? bySku.length : 0 };
  });
  return {
    corpPrefix: result.corpPrefix,
    lastNo: result.lastNo != null ? result.lastNo.toString() : '0',
    updatedSkus: Number(result.updatedSkus) || 0
  };
}

async function updateBatch({ organizationId, batchId, patch, actor }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');
  const data = {};
  if (patch.certificateTemplateId !== undefined) {
    const tplId = patch.certificateTemplateId == null ? null : Number(patch.certificateTemplateId);
    if (tplId != null) {
      const tpl = await withTimeout(
        prisma.certificateTemplate.findFirst({
          where: { id: tplId, organizationId: orgId, deletedAt: null, templateType: 'auth' },
          select: { id: true }
        }),
        1200
      );
      if (!tpl) throw new Error('Certificate template mesti jenis Auth');
    }
    data.certificateTemplateId = tplId;
  }
  if (Object.prototype.hasOwnProperty.call(patch || {}, 'remark')) {
    const v = patch.remark;
    data.remark = v == null ? null : String(v).trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch || {}, 'templateData')) {
    const v = patch.templateData;
    if (v == null) {
      data.templateData = null;
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      data.templateData = Object.keys(v).length ? v : null;
    } else {
      throw new Error('Invalid templateData');
    }
  }
  const itemPatch = {};
  if (Object.prototype.hasOwnProperty.call(patch || {}, 'productionDate')) {
    if (!canOverrideItem({ actor })) {
      const err = new Error('Tiada kebenaran untuk ubah production date.');
      err.status = 403;
      throw err;
    }
    const raw = patch.productionDate;
    const d = raw ? toDateOrNull(raw) : null;
    if (raw && !d) throw new Error('Invalid productionDate');
    itemPatch.productionDate = d;
  }

  if (Object.keys(data).length === 0 && Object.keys(itemPatch).length === 0) throw new Error('No fields to update');

  const result = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      const res = await withTimeout(
        tx.epcBatch.updateMany({
          where: { id, organizationId: orgId },
          data
        }),
        1500
      );
      if (!res.count) throw new Error('Batch tidak dijumpai');
    } else {
      const exists = await withTimeout(tx.epcBatch.findFirst({ where: { id, organizationId: orgId }, select: { id: true } }), 1500);
      if (!exists) throw new Error('Batch tidak dijumpai');
    }

    if (Object.keys(itemPatch).length > 0) {
      await withTimeout(
        tx.epcItem.updateMany({
          where: { organizationId: orgId, batchId: id },
          data: itemPatch
        }),
        5000
      );
    }

    return await withTimeout(
      tx.epcBatch.findFirst({
        where: { id, organizationId: orgId },
        include: {
          product: { select: { id: true, sku: true, name: true, code: true } },
          certificateTemplate: { select: { id: true, certificateId: true, name: true } }
        }
      }),
      1500
    );
  });
  if (!result) throw new Error('Batch tidak dijumpai');
  return result;
}

module.exports = {
  getAllowedCorpPrefixes,
  getNextCertificateId,
  peekCertificateId,
  resetTodayCertificateId,
  generateEpcBatch,
  exportBatchXlsx,
  exportBatchVerifyUrlXlsx,
  listBatches,
  listItems,
  getItemByEpc,
  resetItemsProduction,
  updateItemProduction,
  importProductionXlsx,
  markProductionDone,
  updateBatch,
  deleteBatch,
  importExistingEpc,
  recalculateCorpSequence,
  deleteAllBatches
};
