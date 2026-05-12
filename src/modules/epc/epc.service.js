const prisma = require('../../config/prisma');
const { Prisma } = require('@prisma/client');
const XLSX = require('xlsx');
const { generateCertificateId, peekNextCertificateId } = require('../../utils/id-generator');
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

function formatDdMmYy(d = new Date(), timeZone = null) {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : null;
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', year: '2-digit' }).formatToParts(d);
      const dd = parts.find((p) => p.type === 'day')?.value;
      const mm = parts.find((p) => p.type === 'month')?.value;
      const yy = parts.find((p) => p.type === 'year')?.value;
      if (dd && mm && yy) return `${dd}${mm}${yy}`;
    } catch {
    }
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  return `${dd}${mm}${yy}`;
}

function formatDdMmYyyy(d = new Date(), timeZone = null) {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : null;
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
      const dd = parts.find((p) => p.type === 'day')?.value;
      const mm = parts.find((p) => p.type === 'month')?.value;
      const yyyy = parts.find((p) => p.type === 'year')?.value;
      if (dd && mm && yyyy) return `${dd}${mm}${yyyy}`;
    } catch {
    }
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  return `${dd}${mm}${yyyy}`;
}

function formatYyyyMm(d = new Date(), timeZone = null) {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : null;
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: '2-digit', year: 'numeric' }).formatToParts(d);
      const mm = parts.find((p) => p.type === 'month')?.value;
      const yyyy = parts.find((p) => p.type === 'year')?.value;
      if (mm && yyyy) return `${yyyy}${mm}`;
    } catch {
    }
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  return `${yyyy}${mm}`;
}

function formatYyyyMmDd(d = new Date(), timeZone = null) {
  const tz = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : null;
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
      const dd = parts.find((p) => p.type === 'day')?.value;
      const mm = parts.find((p) => p.type === 'month')?.value;
      const yyyy = parts.find((p) => p.type === 'year')?.value;
      if (dd && mm && yyyy) return `${yyyy}${mm}${dd}`;
    } catch {
    }
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  return `${yyyy}${mm}${dd}`;
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

function buildEpcCode({ corpPrefix, runningNo, ddmmyy }) {
  const padLen = getRunningPadLen();
  const run = padRunningNo(runningNo, padLen);
  return `${corpPrefix}${ddmmyy}${run}`;
}

function parseRunningNoFromEpcCode({ epcCode, corpPrefix }) {
  const code = String(epcCode || '').trim();
  const prefix = String(corpPrefix || '').trim();
  if (!code || !prefix) throw new Error('Invalid EPC code');
  if (!code.startsWith(prefix)) throw new Error(`EPC code does not start with ${prefix}`);

  const padLen = getRunningPadLen();
  const skuLen = getSkuLen();
  const expectedNewLen = prefix.length + 6 + padLen;
  const expectedLegacyLen = prefix.length + skuLen + 4 + padLen;
  if (code.length !== expectedNewLen && code.length !== expectedLegacyLen) throw new Error('EPC code length not supported');

  const run = code.slice(code.length - padLen);
  if (!/^\d+$/.test(run)) throw new Error('Invalid running number in EPC code');

  if (code.length === expectedNewLen) {
    const ddmmyy = code.slice(code.length - (padLen + 6), code.length - padLen);
    if (!/^\d{6}$/.test(ddmmyy)) throw new Error('Invalid DDMMYY in EPC code');
    const dd = Number(ddmmyy.slice(0, 2));
    const mm = Number(ddmmyy.slice(2, 4));
    if (!Number.isFinite(dd) || dd < 1 || dd > 31) throw new Error('Invalid day in EPC code');
    if (!Number.isFinite(mm) || mm < 1 || mm > 12) throw new Error('Invalid month in EPC code');
  } else {
    const mmyy = code.slice(code.length - (padLen + 4), code.length - padLen);
    if (!/^\d{4}$/.test(mmyy)) throw new Error('Invalid MMYY in EPC code');
    const mm = Number(mmyy.slice(0, 2));
    if (!Number.isFinite(mm) || mm < 1 || mm > 12) throw new Error('Invalid month in EPC code');
  }

  return BigInt(run);
}

function parseSkuCodeFromEpcCode({ epcCode, corpPrefix }) {
  const code = String(epcCode || '').trim();
  const prefix = String(corpPrefix || '').trim();
  if (!code || !prefix) throw new Error('Invalid EPC code');
  if (!code.startsWith(prefix)) throw new Error(`EPC code does not start with ${prefix}`);

  const padLen = getRunningPadLen();
  const skuLen = getSkuLen();
  const expectedNewLen = prefix.length + 6 + padLen;
  const expectedLegacyLen = prefix.length + skuLen + 4 + padLen;
  if (code.length === expectedNewLen) throw new Error('SKU code not present in EPC code');
  if (code.length !== expectedLegacyLen) throw new Error('EPC code length not supported');

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
    const expectedLegacyLen = prefix.length + skuLen + 4 + padLen;
    const expectedNewLen = prefix.length + 6 + padLen;
    if (code.length !== expectedLegacyLen && code.length !== expectedNewLen) continue;
    if (!code.startsWith(prefix)) continue;
    try {
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
      await tx.corpMonthSequence.deleteMany({
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

async function generateEpcBatch({ organizationId, corpPrefix, batchQty, remark }) {
  const allowed = getAllowedCorpPrefixes();
  if (!allowed.includes(corpPrefix)) throw new Error('Corp code tidak dibenarkan');

  const orgId = Number(organizationId);
  const qty = Number(batchQty);
  if (!Number.isFinite(qty) || qty < 1 || qty > 5000) throw new Error('Invalid batch quantity');

  let timeZone = null;
  try {
    const settings = await settingsService.ensureOrganizationSettings(orgId);
    timeZone = settings?.defaultTimezone || null;
  } catch {
  }

  const now = new Date();
  const ddmmyy = formatDdMmYy(now, timeZone);
  const ddmmyyyy = formatDdMmYyyy(now, timeZone);
  const periodKey = formatYyyyMm(now, timeZone);
  const batchDateKey = formatYyyyMmDd(now, timeZone);

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.epcBatchSequence.upsert({
        where: { dateKey: batchDateKey },
        update: {},
        create: { dateKey: batchDateKey, lastNo: 0n }
      });

      await tx.corpMonthSequence.upsert({
        where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
        update: {},
        create: { organizationId: orgId, corpPrefix, periodKey, lastNo: 0n }
      });

      const batchSeqRows = await tx.$queryRaw`
        SELECT lastNo FROM \`EpcBatchSequence\`
        WHERE dateKey = ${batchDateKey}
        FOR UPDATE
      `;
      const batchSeqCurrent = batchSeqRows && batchSeqRows[0] && batchSeqRows[0].lastNo !== undefined ? BigInt(batchSeqRows[0].lastNo) : 0n;
      const batchSeqNext = batchSeqCurrent + 1n;
      await tx.epcBatchSequence.update({ where: { dateKey: batchDateKey }, data: { lastNo: batchSeqNext } });
      const batchName = `B-${ddmmyyyy}${String(batchSeqNext).padStart(6, '0')}`;

      const rows = await tx.$queryRaw`
        SELECT lastNo FROM \`CorpMonthSequence\`
        WHERE organizationId = ${orgId} AND corpPrefix = ${corpPrefix} AND periodKey = ${periodKey}
        FOR UPDATE
      `;

      const current = rows && rows[0] && rows[0].lastNo !== undefined ? BigInt(rows[0].lastNo) : 0n;
      const startNo = current + 1n;
      const endNo = current + BigInt(qty);
      await tx.corpMonthSequence.update({
        where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
        data: { lastNo: endNo }
      });

      const batch = await tx.epcBatch.create({
        data: {
          organizationId: orgId,
          corpPrefix,
          periodKey,
          origin: 'generated',
          productId: null,
          sku: null,
          batchName,
          batchQty: qty,
          remark: remark || null,
          certificateId: null,
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

      const items = [];
      for (let i = 0; i < qty; i += 1) {
        const runningNo = startNo + BigInt(i);
        const epcCode = buildEpcCode({ corpPrefix, runningNo: runningNo.toString(), ddmmyy });
        items.push({
          organizationId: orgId,
          batchId: batch.id,
          epcCode,
          runningNo,
          netWeight: null,
          productionDate: null,
          caiqNumber: null
        });
      }

      for (const c of chunkArray(items, 1000)) {
        await tx.epcItem.createMany({ data: c });
      }

      return { batch, created: qty, startNo: startNo.toString(), endNo: endNo.toString() };
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

async function exportBatchProductionTemplateXlsx({ organizationId, batchId }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');

  const batch = await withTimeout(
    prisma.epcBatch.findFirst({
      where: { id, organizationId: orgId },
      include: { product: { select: { name: true } } }
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

  const header = [
    'EPC',
    'Barcode',
    'Individual Label (CAIQ)',
    'Net Weight',
    'Manufacture Date',
    'Batch Number',
    'Swiftlet House Number'
  ];

  const ws = XLSX.utils.json_to_sheet(
    items.map((it) => ({
      [header[0]]: String(it.epcCode || '').trim(),
      [header[1]]: '',
      [header[2]]: '',
      [header[3]]: '',
      [header[4]]: '',
      [header[5]]: '',
      [header[6]]: ''
    })),
    { header }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'template');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const safePart = (v, fallback) => String(v || fallback).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || fallback;
  const safeProduct = safePart(batch.product?.name, 'product');
  const safeBatch = safePart(batch.batchName, 'batch');
  const safeQty = safePart(batch.batchQty, 'qty');
  const filename = `${safeProduct}_${safeBatch}_${safeQty}_input_template.xlsx`;
  return { buffer, filename };
}

async function exportBatchImportTemplateXlsx() {
  const header = [
    'EPC',
    'Barcode',
    'Individual Label (CAIQ)',
    'Net Weight',
    'Manufacture Date',
    'Batch Number',
    'Swiftlet House Number'
  ];

  const ws = XLSX.utils.aoa_to_sheet([header]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'epc');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `batch_import_template_${formatYyyyMmDd(new Date())}.xlsx`;
  return { buffer, filename };
}

async function exportItemsXlsx({ organizationId, itemIds, q, createdFrom, createdTo, columns }) {
  const orgId = Number(organizationId);
  const ids = Array.from(new Set((Array.isArray(itemIds) ? itemIds : []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)));
  const query = typeof q === 'string' ? q.trim() : '';

  const where = {
    organizationId: orgId,
    ...(ids.length ? { id: { in: ids } } : {}),
    ...((createdFrom || createdTo)
      ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {})
          }
        }
      : {}),
    ...(query ? { epcCode: { contains: query } } : {})
  };

  const items = await withTimeout(
    prisma.epcItem.findMany({
      where,
      include: { batch: { select: { remark: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: ids.length ? undefined : 10_000
    }),
    12_000
  );
  if (!Array.isArray(items) || items.length === 0) throw new Error('No data to export');

  const codes = (Array.isArray(items) ? items : [])
    .map((it) => String(it?.epcCode || '').trim().toUpperCase())
    .filter((s) => s);

  const activeSet = new Set();
  if (codes.length) {
    const actives = await withTimeout(
      prisma.tagIdentity.findMany({
        where: { organizationId: orgId, epc: { in: codes }, unassignedAt: null },
        select: { epc: true }
      }),
      12_000
    );
    for (const r of Array.isArray(actives) ? actives : []) {
      const epc = String(r?.epc || '').trim();
      if (epc) activeSet.add(epc);
    }
  }

  const allowedColumns = new Set([
    'epcCode',
    'status',
    'barcode',
    'caiqNumber',
    'netWeight',
    'manufactureDate',
    'batchNumber',
    'swiftletHouseNumber',
    'createdAt',
    'remark'
  ]);
  const requested = Array.isArray(columns) ? columns : [];
  const unique = [];
  for (const c of requested) {
    const key = String(c || '').trim();
    if (!key || !allowedColumns.has(key) || unique.includes(key)) continue;
    unique.push(key);
  }
  const exportColumns =
    unique.length > 0
      ? unique
      : ['epcCode', 'barcode', 'caiqNumber', 'netWeight', 'manufactureDate', 'batchNumber', 'swiftletHouseNumber'];

  const rows = (Array.isArray(items) ? items : []).map((it) => {
    const status = activeSet.has(String(it.epcCode || '').trim()) ? 'ACTIVE' : 'INACTIVE';
    const row = {};
    for (const col of exportColumns) {
      if (col === 'status') row[col] = status;
      else if (col === 'remark') row[col] = it.batch?.remark == null ? '' : String(it.batch.remark);
      else if (col === 'createdAt') row[col] = it.createdAt ? new Date(it.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '';
      else if (col === 'manufactureDate') row[col] = it.productionDate ? new Date(it.productionDate).toISOString().slice(0, 10) : '';
      else {
        const v = it[col];
        row[col] = v == null ? '' : String(v);
      }
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: exportColumns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'epc_items');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `epc_items_${formatYyyyMmDd(new Date())}.xlsx`;
  return { buffer, filename };
}

async function deleteItems({ organizationId, itemIds, cleanup }) {
  const orgId = Number(organizationId);
  const ids = Array.from(new Set((Array.isArray(itemIds) ? itemIds : []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)));
  if (!ids.length) return { deletedItems: 0, deletedBatches: 0 };
  const cleanupRequested = Boolean(cleanup);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.epcItem.findMany({
      where: { organizationId: orgId, id: { in: ids } },
      select: { id: true, batchId: true, epcCode: true }
    });
    if (!existing.length) return { deletedItems: 0, deletedBatches: 0 };

    const deletedByBatch = new Map();
    for (const it of existing) {
      const bid = Number(it.batchId);
      if (!Number.isFinite(bid)) continue;
      deletedByBatch.set(bid, (deletedByBatch.get(bid) || 0) + 1);
    }

    const batchIds = Array.from(deletedByBatch.keys());
    const batches =
      cleanupRequested && batchIds.length
        ? await tx.epcBatch.findMany({
            where: { organizationId: orgId, id: { in: batchIds } },
            select: { id: true, corpPrefix: true, periodKey: true, sku: true }
          })
        : [];

    if (cleanupRequested) {
      const epcCodes = Array.from(new Set(existing.map((r) => String(r.epcCode || '').trim()).filter((s) => s)));
      if (epcCodes.length) {
        await tx.tagIdentity.updateMany({
          where: { organizationId: orgId, epc: { in: epcCodes } },
          data: { epc: null, unassignedAt: new Date() }
        });
        await tx.scanLog.updateMany({
          where: { epc: { in: epcCodes } },
          data: { epc: null }
        });
      }
    }

    const res = await tx.epcItem.deleteMany({ where: { organizationId: orgId, id: { in: existing.map((r) => Number(r.id)) } } });
    const deletedItems = Number(res.count) || 0;

    for (const [batchId, dec] of deletedByBatch.entries()) {
      const d = Number(dec) || 0;
      if (!d) continue;
      await tx.$executeRaw(
        Prisma.sql`UPDATE \`EpcBatch\` SET batchQty = GREATEST(0, batchQty - ${d}) WHERE organizationId = ${orgId} AND id = ${batchId}`
      );
    }

    let deletedBatches = 0;
    if (batchIds.length) {
      const rows = await tx.$queryRaw(
        Prisma.sql`
          SELECT batchId AS batchId, COUNT(id) AS cnt
          FROM \`EpcItem\`
          WHERE organizationId = ${orgId}
            AND batchId IN (${Prisma.join(batchIds)})
          GROUP BY batchId
        `
      );
      const remainingByBatch = new Map();
      for (const r of Array.isArray(rows) ? rows : []) {
        const bid = Number(r.batchId);
        if (!Number.isFinite(bid)) continue;
        remainingByBatch.set(bid, Number(r.cnt) || 0);
      }

      const emptyBatchIds = batchIds.filter((bid) => (remainingByBatch.get(bid) || 0) <= 0);
      if (emptyBatchIds.length) {
        const del = await tx.epcBatch.deleteMany({ where: { organizationId: orgId, id: { in: emptyBatchIds } } });
        deletedBatches = Number(del.count) || 0;
      }
    }

    if (cleanupRequested && Array.isArray(batches) && batches.length) {
      const monthKeys = new Map();
      const skuKeys = new Map();
      for (const b of batches) {
        const corpPrefix = String(b.corpPrefix || '').trim();
        if (!corpPrefix) continue;
        const periodKey = b.periodKey ? String(b.periodKey || '').trim() : '';
        if (periodKey) {
          monthKeys.set(`${corpPrefix}|${periodKey}`, { corpPrefix, periodKey });
          continue;
        }
        const skuCode = normalizeSkuCode({ sku: b.sku || '' });
        if (skuCode) skuKeys.set(`${corpPrefix}|${skuCode}`, { corpPrefix, skuCode });
      }

      for (const { corpPrefix, periodKey } of monthKeys.values()) {
        await tx.corpMonthSequence.upsert({
          where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
          update: {},
          create: { organizationId: orgId, corpPrefix, periodKey, lastNo: 0n }
        });
        const maxExisting = await tx.epcItem.findFirst({
          where: { organizationId: orgId, batch: { corpPrefix, periodKey } },
          orderBy: { runningNo: 'desc' },
          select: { runningNo: true }
        });
        const nextLastNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
        await tx.corpMonthSequence.update({
          where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
          data: { lastNo: nextLastNo }
        });
      }

      for (const { corpPrefix, skuCode } of skuKeys.values()) {
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
    }

    return { deletedItems, deletedBatches };
  });

  return result;
}

async function deleteAllGeneratedBatches({ organizationId, corpPrefix }) {
  const orgId = Number(organizationId);
  const prefix = corpPrefix == null ? null : String(corpPrefix || '').trim();
  if (prefix) {
    const allowed = getAllowedCorpPrefixes();
    if (!allowed.includes(prefix)) throw new Error('Corp code tidak dibenarkan');
  }

  const result = await prisma.$transaction(async (tx) => {
    const batches = await tx.epcBatch.findMany({
      where: { organizationId: orgId, origin: 'generated', ...(prefix ? { corpPrefix: prefix } : {}) },
      select: { id: true, corpPrefix: true, periodKey: true, sku: true }
    });
    if (!batches.length) return { deletedBatches: 0, deletedItems: 0, corpPrefixes: prefix ? [prefix] : [] };

    const ids = batches.map((b) => Number(b.id)).filter((n) => Number.isFinite(n));
    const prefixes = Array.from(new Set(batches.map((b) => String(b.corpPrefix || '').trim()).filter((p) => p)));

    const monthKeys = new Map();
    const skuKeys = new Map();
    for (const b of batches) {
      const corp = String(b.corpPrefix || '').trim();
      if (!corp) continue;
      const pk = b.periodKey ? String(b.periodKey || '').trim() : '';
      if (pk) {
        monthKeys.set(`${corp}|${pk}`, { corpPrefix: corp, periodKey: pk });
        continue;
      }
      const skuCode = normalizeSkuCode({ sku: b.sku || '' });
      if (skuCode) skuKeys.set(`${corp}|${skuCode}`, { corpPrefix: corp, skuCode });
    }

    for (const group of chunkArray(ids, 1000)) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE \`TagIdentity\` t
          JOIN \`EpcItem\` i
            ON i.organizationId = t.organizationId
           AND i.epcCode = t.epc
          JOIN \`EpcBatch\` b
            ON b.id = i.batchId
          SET t.epc = NULL, t.unassignedAt = NOW()
          WHERE t.organizationId = ${orgId}
            AND b.organizationId = ${orgId}
            AND b.origin = 'generated'
            AND i.batchId IN (${Prisma.join(group)})
        `
      );
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE \`ScanLog\` s
          JOIN \`EpcItem\` i
            ON i.epcCode = s.epc
          JOIN \`EpcBatch\` b
            ON b.id = i.batchId
          SET s.epc = NULL
          WHERE b.organizationId = ${orgId}
            AND b.origin = 'generated'
            AND i.batchId IN (${Prisma.join(group)})
        `
      );
    }

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

    for (const { corpPrefix, periodKey } of monthKeys.values()) {
      await tx.corpMonthSequence.upsert({
        where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
        update: {},
        create: { organizationId: orgId, corpPrefix, periodKey, lastNo: 0n }
      });
      const maxExisting = await tx.epcItem.findFirst({
        where: { organizationId: orgId, batch: { corpPrefix, periodKey } },
        orderBy: { runningNo: 'desc' },
        select: { runningNo: true }
      });
      const nextLastNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
      await tx.corpMonthSequence.update({
        where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
        data: { lastNo: nextLastNo }
      });
    }

    for (const { corpPrefix, skuCode } of skuKeys.values()) {
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

    return { deletedBatches, deletedItems, corpPrefixes: prefixes };
  });

  return {
    deletedBatches: Number(result.deletedBatches) || 0,
    deletedItems: Number(result.deletedItems) || 0,
    corpPrefixes: Array.isArray(result.corpPrefixes) ? result.corpPrefixes : []
  };
}

async function listBatches({ organizationId, q, origin, limit, offset }) {
  const orgId = Number(organizationId);
  const originKey = typeof origin === 'string' ? origin.trim().toLowerCase() : '';
  const originFilter = originKey === 'generated' || originKey === 'import' ? originKey : '';
  const where = {
    organizationId: orgId,
    ...(originFilter ? { origin: originFilter } : {}),
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
          certificateTemplate: { select: { id: true, certificateId: true, name: true } },
          documents: { select: { docType: true, mediaUrl: true, uploadedAt: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
    ]),
    2500
  );

  const batchIds = (Array.isArray(items) ? items : []).map((b) => Number(b.id)).filter((n) => Number.isFinite(n));
  const activeByBatchId = new Map();
  if (batchIds.length) {
    const rows = await withTimeout(
      prisma.$queryRaw(
        Prisma.sql`
          SELECT
            i.batchId AS batchId,
            COUNT(t.id) AS activeCount
          FROM \`EpcItem\` i
          LEFT JOIN \`TagIdentity\` t
            ON t.organizationId = i.organizationId
           AND t.epc = i.epcCode
           AND t.unassignedAt IS NULL
          WHERE i.organizationId = ${orgId}
            AND i.batchId IN (${Prisma.join(batchIds)})
          GROUP BY i.batchId
        `
      ),
      2500
    );
    for (const r of Array.isArray(rows) ? rows : []) {
      const id = Number(r.batchId);
      if (!Number.isFinite(id)) continue;
      activeByBatchId.set(id, Number(r.activeCount) || 0);
    }
  }

  const itemsWithStats = (Array.isArray(items) ? items : []).map((b) => {
    const id = Number(b.id);
    const activeCount = activeByBatchId.get(id) || 0;
    const generatedQty = Number(b.batchQty) || 0;
    const inactiveCount = Math.max(0, generatedQty - activeCount);
    return { ...b, activeCount, inactiveCount };
  });

  return { items: itemsWithStats, total, limit, offset };
}

async function listItems({ organizationId, q, batchId, pendingOnly, createdFrom, createdTo, limit, offset }) {
  const orgId = Number(organizationId);
  const where = {
    organizationId: orgId,
    ...(batchId ? { batchId: Number(batchId) } : {}),
    ...((createdFrom || createdTo)
      ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdTo ? { lte: createdTo } : {})
          }
        }
      : {}),
    ...(pendingOnly
      ? {
          OR: [{ netWeight: null }, { netWeight: '' }]
        }
      : {}),
    ...(q
      ? {
          OR: [{ epcCode: { contains: q } }]
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
              remark: true,
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

  const codes = (Array.isArray(items) ? items : [])
    .map((it) => String(it?.epcCode || '').trim())
    .filter((s) => s);

  const activeSet = new Set();
  if (codes.length) {
    const actives = await withTimeout(
      prisma.tagIdentity.findMany({
        where: { organizationId: orgId, epc: { in: codes }, unassignedAt: null },
        select: { epc: true }
      }),
      2500
    );
    for (const r of Array.isArray(actives) ? actives : []) {
      const epc = String(r?.epc || '').trim().toUpperCase();
      if (epc) activeSet.add(epc);
    }
  }

  const itemsWithStatus = (Array.isArray(items) ? items : []).map((it) => ({
    ...it,
    status: activeSet.has(String(it?.epcCode || '').trim().toUpperCase()) ? 'ACTIVE' : 'INACTIVE'
  }));

  return { items: itemsWithStatus, total, limit, offset };
}

const EPC_ITEM_INCLUDE = {
  batch: {
    select: {
      id: true,
      corpPrefix: true,
      batchName: true,
      batchQty: true,
      remark: true,
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

function pickByPrefix(obj, prefixes) {
  const o = obj && typeof obj === 'object' ? obj : {};
  const keys = Object.keys(o);
  for (const p of Array.isArray(prefixes) ? prefixes : []) {
    const pref = String(p || '').trim().toLowerCase();
    if (!pref) continue;
    const k = keys.find((kk) => String(kk || '').toLowerCase().startsWith(pref));
    if (!k) continue;
    const v = o[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function pickRawByPrefix(obj, prefixes) {
  const o = obj && typeof obj === 'object' ? obj : {};
  const keys = Object.keys(o);
  for (const p of Array.isArray(prefixes) ? prefixes : []) {
    const pref = String(p || '').trim().toLowerCase();
    if (!pref) continue;
    const k = keys.find((kk) => String(kk || '').toLowerCase().startsWith(pref));
    if (!k) continue;
    const v = o[k];
    if (v == null) continue;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s) return s;
      continue;
    }
    return v;
  }
  return null;
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
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) {
      const d = XLSX.SSF.parse_date_code(n);
      if (d && d.y && d.m && d.d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
    }
  }
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
    const epcCode = String(n.epccode || n.epc || n.code || '').trim().toUpperCase();
    if (!epcCode) continue;
    updates.push({
      epcCode,
      barcode: pickByPrefix(n, ['barcode']),
      batchNumber: pickByPrefix(n, ['batchnumber', 'batchno', 'batch']),
      swiftletHouseNumber: pickByPrefix(n, ['swiftlethousenumber', 'swiftlethouse', 'housenumber']),
      netWeight: pickByPrefix(n, ['netweight', 'net_weight']),
      productionDate: toDateOrNull(pickByPrefix(n, ['manufacturedate', 'productiondate', 'dateofproduction', 'production_date'])),
      caiqNumber: pickByPrefix(n, [
        'individuallabel(caiq)',
        'individuallabel',
        'caiqnumber',
        'caiq',
        'caiqlabel',
        'caiq_label'
      ])
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
        data: {
          barcode: u.barcode,
          batchNumber: u.batchNumber,
          swiftletHouseNumber: u.swiftletHouseNumber,
          netWeight: u.netWeight,
          productionDate: u.productionDate,
          caiqNumber: u.caiqNumber
        }
      });
      updated += res.count || 0;
    }

    await tx.epcBatch.update({ where: { id }, data: { productionUploadedAt: new Date() } });
    return { batchId: id, rows: updates.length, updated };
  });

  return result;
}

function extractUniqueBatchMetaFromUpdates(updates) {
  const dates = new Set();
  const batchNumbers = new Set();
  const swiftletHouseNumbers = new Set();

  for (const u of Array.isArray(updates) ? updates : []) {
    if (u?.productionDate instanceof Date && !Number.isNaN(u.productionDate.getTime())) {
      dates.add(u.productionDate.toISOString().slice(0, 10));
    }
    if (u?.batchNumber) batchNumbers.add(String(u.batchNumber).trim());
    if (u?.swiftletHouseNumber) swiftletHouseNumbers.add(String(u.swiftletHouseNumber).trim());
  }

  const manufactureDate = dates.size === 1 ? Array.from(dates)[0] : null;
  const batchNumber = batchNumbers.size === 1 ? Array.from(batchNumbers)[0] : null;
  const swiftletHouseNumber = swiftletHouseNumbers.size === 1 ? Array.from(swiftletHouseNumbers)[0] : null;

  if (!manufactureDate) throw new Error('Manufacture date must be present and unique in the uploaded XLSX.');
  if (!batchNumber) throw new Error('Batch number must be present and unique in the uploaded XLSX.');
  if (!swiftletHouseNumber) throw new Error('Swiftlet house number must be present and unique in the uploaded XLSX.');

  return { manufactureDate, batchNumber, swiftletHouseNumber };
}

function getBatchImportDocTypes() {
  return new Set(['moh_health_certificate', 'export_permit', 'dvs_health_certificate', 'dvs_coo_certificate']);
}

async function previewBatchImportXlsx({ organizationId, batchId, base64 }) {
  const orgId = Number(organizationId);
  const id = batchId == null ? null : Number(batchId);
  if (id != null && !Number.isFinite(id)) throw new Error('Invalid batch id');

  if (id != null) {
    const exists = await withTimeout(prisma.epcBatch.findFirst({ where: { id, organizationId: orgId }, select: { id: true } }), 1500);
    if (!exists) throw new Error('Batch not found');
  }

  const { rows } = parseXlsxBase64(base64);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Excel is empty');

  const updates = [];
  for (const r of rows) {
    const n = normalizeRowKeys(r);
    const epcCode = String(n.epccode || n.epc || n.code || '').trim().toUpperCase();
    if (!epcCode) continue;
    updates.push({
      epcCode,
      batchNumber: pickByPrefix(n, ['batchnumber', 'batchno', 'batch']),
      swiftletHouseNumber: pickByPrefix(n, ['swiftlethousenumber', 'swiftlethouse', 'housenumber']),
      productionDate: toDateOrNull(pickRawByPrefix(n, ['manufacturedate', 'productiondate', 'dateofproduction', 'production_date']))
    });
  }
  if (updates.length === 0) throw new Error('No EPC code found in the uploaded XLSX.');

  const meta = extractUniqueBatchMetaFromUpdates(updates);
  return { ...meta, rows: updates.length };
}

async function createImportBatchFromXlsx({
  organizationId,
  base64,
  productId,
  sku,
  certificateTemplateId,
  documents
}) {
  const orgId = Number(organizationId);
  const { rows } = parseXlsxBase64(base64);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Excel is empty');

  const updates = [];
  for (const r of rows) {
    const n = normalizeRowKeys(r);
    const epcCode = String(n.epccode || n.epc || n.code || '').trim().toUpperCase();
    if (!epcCode) continue;
    updates.push({
      epcCode,
      barcode: pickByPrefix(n, ['barcode']),
      batchNumber: pickByPrefix(n, ['batchnumber', 'batchno', 'batch']),
      swiftletHouseNumber: pickByPrefix(n, ['swiftlethousenumber', 'swiftlethouse', 'housenumber']),
      netWeight: pickByPrefix(n, ['netweight', 'net_weight']),
      productionDate: toDateOrNull(pickRawByPrefix(n, ['manufacturedate', 'productiondate', 'dateofproduction', 'production_date'])),
      caiqNumber: pickByPrefix(n, [
        'individuallabel(caiq)',
        'individuallabel',
        'caiqnumber',
        'caiq',
        'caiqlabel',
        'caiq_label'
      ])
    });
  }
  if (updates.length === 0) throw new Error('No EPC code found in the uploaded XLSX.');

  const meta = extractUniqueBatchMetaFromUpdates(updates);
  const skuCode = String(sku || '').trim();
  if (!skuCode) throw new Error('SKU code is required.');

  const epcCodes = updates.map((u) => String(u.epcCode || '').trim()).filter(Boolean);
  const uniqueEpcs = Array.from(new Set(epcCodes));
  if (uniqueEpcs.length !== epcCodes.length) throw new Error('Duplicate EPC code detected in the uploaded XLSX.');

  const docTypes = getBatchImportDocTypes();
  const docEntries = Object.entries(documents && typeof documents === 'object' ? documents : {}).map(([k, v]) => [String(k || '').trim(), String(v || '').trim()]);
  for (const [k, v] of docEntries) {
    if (!docTypes.has(k)) throw new Error('Invalid supporting certificate type.');
    if (!v) throw new Error('Supporting certificate URL is required.');
  }
  for (const required of docTypes) {
    const has = docEntries.some(([k]) => k === required);
    if (!has) throw new Error('All 4 supporting certificates are required.');
  }

  let timeZone = null;
  try {
    const settings = await settingsService.ensureOrganizationSettings(orgId);
    timeZone = settings?.defaultTimezone || null;
  } catch {
  }

  const now = new Date();
  const ddmmyyyy = formatDdMmYyyy(now, timeZone);
  const dateKey = formatYyyyMmDd(now, timeZone);

  const allowedPrefixes = getAllowedCorpPrefixes();
  const detected = new Set(
    uniqueEpcs
      .map((code) => allowedPrefixes.find((p) => String(code || '').startsWith(String(p || ''))))
      .filter(Boolean)
  );
  if (detected.size > 1) throw new Error('Excel contains multiple corp codes; import must be one corp code only.');
  const corpPrefix = detected.size === 1 ? Array.from(detected)[0] : allowedPrefixes[0] || 'DA01';

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.importBatchSequence.upsert({
        where: { dateKey },
        update: {},
        create: { dateKey, lastNo: 0n }
      });

      const seqRows = await tx.$queryRaw`
        SELECT lastNo FROM \`ImportBatchSequence\`
        WHERE dateKey = ${dateKey}
        FOR UPDATE
      `;
      const current = seqRows && seqRows[0] && seqRows[0].lastNo !== undefined ? BigInt(seqRows[0].lastNo) : 0n;
      const next = current + 1n;
      await tx.importBatchSequence.update({ where: { dateKey }, data: { lastNo: next } });
      const batchName = `Import - ${ddmmyyyy}${String(next).padStart(6, '0')}`;

      const pid = productId != null ? Number(productId) : null;
      if (!pid || !Number.isFinite(pid) || pid <= 0) throw new Error('Product is required.');
      const product = await tx.product.findFirst({ where: { id: pid, organizationId: orgId }, select: { id: true } });
      if (!product) throw new Error('Product not found.');

      let tplId = null;
      if (certificateTemplateId !== undefined) {
        tplId = certificateTemplateId == null ? null : Number(certificateTemplateId);
        if (tplId != null) {
          const tpl = await tx.certificateTemplate.findFirst({
            where: { id: tplId, organizationId: orgId, deletedAt: null, templateType: 'auth' },
            select: { id: true }
          });
          if (!tpl) throw new Error('Auth certificate template not found.');
        }
      }

      const existing = await tx.epcItem.findMany({
        where: { organizationId: orgId, epcCode: { in: uniqueEpcs } },
        select: { epcCode: true },
        take: 50
      });
      if (existing.length) {
        const sample = existing.map((r) => String(r.epcCode || '').trim()).filter(Boolean).slice(0, 10);
        throw new Error(`Some EPC codes already exist in the system: ${sample.join(', ')}${existing.length > 10 ? ', ...' : ''}`);
      }

      const batch = await tx.epcBatch.create({
        data: {
          organizationId: orgId,
          corpPrefix,
          periodKey: null,
          origin: 'import',
          productId: pid,
          sku: skuCode,
          batchName,
          batchQty: uniqueEpcs.length,
          remark: null,
          certificateId: null,
          certificateTemplateId: tplId,
          templateData: {
            manufactureDate: meta.manufactureDate,
            batchNumber: meta.batchNumber,
            swiftletHouseNumber: meta.swiftletHouseNumber
          },
          productionUploadedAt: new Date(),
          productionDoneAt: null
        },
        select: { id: true }
      });

      const items = updates.map((u, idx) => ({
        organizationId: orgId,
        batchId: batch.id,
        epcCode: String(u.epcCode || '').trim(),
        runningNo: BigInt(idx + 1),
        barcode: u.barcode,
        batchNumber: u.batchNumber,
        swiftletHouseNumber: u.swiftletHouseNumber,
        netWeight: u.netWeight,
        productionDate: u.productionDate,
        caiqNumber: u.caiqNumber
      }));

      for (const c of chunkArray(items, 1000)) {
        await tx.epcItem.createMany({ data: c });
      }

      for (const [docType, mediaUrl] of docEntries) {
        await tx.epcBatchDocument.upsert({
          where: { batchId_docType: { batchId: batch.id, docType } },
          update: { mediaUrl, uploadedAt: new Date() },
          create: { organizationId: orgId, batchId: batch.id, docType, mediaUrl }
        });
      }

      const full = await tx.epcBatch.findFirst({
        where: { id: batch.id, organizationId: orgId },
        include: {
          product: { select: { id: true, sku: true, name: true, code: true } },
          certificateTemplate: { select: { id: true, certificateId: true, name: true } },
          documents: { select: { docType: true, mediaUrl: true, uploadedAt: true } }
        }
      });

      return { batchId: batch.id, rows: updates.length, created: items.length, meta, batch: full };
    },
    { timeout: 12_000, maxWait: 5_000 }
  );

  return result;
}

async function submitBatchImport({
  organizationId,
  batchId,
  base64,
  productId,
  sku,
  certificateTemplateId,
  documents
}) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');

  const { rows } = parseXlsxBase64(base64);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Excel is empty');

  const updates = [];
  for (const r of rows) {
    const n = normalizeRowKeys(r);
    const epcCode = String(n.epccode || n.epc || n.code || '').trim();
    if (!epcCode) continue;
    updates.push({
      epcCode,
      barcode: pickByPrefix(n, ['barcode']),
      batchNumber: pickByPrefix(n, ['batchnumber', 'batchno', 'batch']),
      swiftletHouseNumber: pickByPrefix(n, ['swiftlethousenumber', 'swiftlethouse', 'housenumber']),
      netWeight: pickByPrefix(n, ['netweight', 'net_weight']),
      productionDate: toDateOrNull(pickRawByPrefix(n, ['manufacturedate', 'productiondate', 'dateofproduction', 'production_date'])),
      caiqNumber: pickByPrefix(n, ['individuallabel(caiq)', 'caiqnumber', 'caiq', 'caiqlabel', 'caiq_label'])
    });
  }
  if (updates.length === 0) throw new Error('No EPC code found in the uploaded XLSX.');

  const meta = extractUniqueBatchMetaFromUpdates(updates);
  const skuCode = String(sku || '').trim();
  if (!skuCode) throw new Error('SKU code is required.');

  const docTypes = getBatchImportDocTypes();
  const docEntries = Object.entries(documents && typeof documents === 'object' ? documents : {}).map(([k, v]) => [String(k || '').trim(), String(v || '').trim()]);
  for (const [k, v] of docEntries) {
    if (!docTypes.has(k)) throw new Error('Invalid supporting certificate type.');
    if (!v) throw new Error('Supporting certificate URL is required.');
  }
  for (const required of docTypes) {
    const has = docEntries.some(([k]) => k === required);
    if (!has) throw new Error('All 4 supporting certificates are required.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.epcBatch.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, templateData: true }
    });
    if (!batch) throw new Error('Batch not found');

    const pid = productId != null ? Number(productId) : null;
    if (!pid || !Number.isFinite(pid) || pid <= 0) throw new Error('Product is required.');
    const product = await tx.product.findFirst({ where: { id: pid, organizationId: orgId }, select: { id: true } });
    if (!product) throw new Error('Product not found.');

    let tplId = null;
    if (certificateTemplateId !== undefined) {
      tplId = certificateTemplateId == null ? null : Number(certificateTemplateId);
      if (tplId != null) {
        const tpl = await tx.certificateTemplate.findFirst({
          where: { id: tplId, organizationId: orgId, deletedAt: null, templateType: 'auth' },
          select: { id: true }
        });
        if (!tpl) throw new Error('Auth certificate template not found.');
      }
    }

    const epcCodes = Array.from(new Set(updates.map((u) => String(u.epcCode || '').trim()).filter(Boolean)));
    const inBatchCount = await tx.epcItem.count({ where: { organizationId: orgId, batchId: id, epcCode: { in: epcCodes } } });
    if (inBatchCount !== epcCodes.length) {
      throw new Error('The uploaded XLSX contains EPC codes that do not belong to the selected batch.');
    }

    let updated = 0;
    for (const u of updates) {
      const data = {};
      if (u.barcode != null) data.barcode = u.barcode;
      if (u.batchNumber != null) data.batchNumber = u.batchNumber;
      if (u.swiftletHouseNumber != null) data.swiftletHouseNumber = u.swiftletHouseNumber;
      if (u.netWeight != null) data.netWeight = u.netWeight;
      if (u.productionDate != null) data.productionDate = u.productionDate;
      if (u.caiqNumber != null) data.caiqNumber = u.caiqNumber;
      if (Object.keys(data).length === 0) continue;
      const res = await tx.epcItem.updateMany({
        where: { organizationId: orgId, batchId: id, epcCode: u.epcCode },
        data
      });
      updated += res.count || 0;
    }

    const prev = batch.templateData && typeof batch.templateData === 'object' && !Array.isArray(batch.templateData) ? batch.templateData : {};
    const nextTemplateData = {
      ...prev,
      manufactureDate: meta.manufactureDate,
      batchNumber: meta.batchNumber,
      swiftletHouseNumber: meta.swiftletHouseNumber
    };

    await tx.epcBatch.update({
      where: { id },
      data: {
        productId: pid,
        sku: skuCode,
        certificateTemplateId: tplId,
        templateData: nextTemplateData,
        productionUploadedAt: new Date()
      }
    });

    for (const [docType, mediaUrl] of docEntries) {
      await tx.epcBatchDocument.upsert({
        where: { batchId_docType: { batchId: id, docType } },
        update: { mediaUrl, uploadedAt: new Date() },
        create: { organizationId: orgId, batchId: id, docType, mediaUrl }
      });
    }

    const full = await tx.epcBatch.findFirst({
      where: { id, organizationId: orgId },
      include: {
        product: { select: { id: true, sku: true, name: true, code: true } },
        certificateTemplate: { select: { id: true, certificateId: true, name: true } },
        documents: { select: { docType: true, mediaUrl: true, uploadedAt: true } }
      }
    });
    return { batchId: id, rows: updates.length, updated, meta, batch: full };
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
    const periodKey = batch.periodKey ? String(batch.periodKey || '').trim() : '';
    const skuCode = normalizeSkuCode({ sku: batch.sku || '' });
    await tx.epcItem.deleteMany({ where: { organizationId: orgId, batchId: id } });
    await tx.epcBatch.delete({ where: { id } });
    if (corpPrefix && periodKey) {
      await tx.corpMonthSequence.upsert({
        where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
        update: {},
        create: { organizationId: orgId, corpPrefix, periodKey, lastNo: 0n }
      });
      const maxExisting = await tx.epcItem.findFirst({
        where: { organizationId: orgId, batch: { corpPrefix, periodKey } },
        orderBy: { runningNo: 'desc' },
        select: { runningNo: true }
      });
      const nextLastNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
      await tx.corpMonthSequence.update({
        where: { organizationId_corpPrefix_periodKey: { organizationId: orgId, corpPrefix, periodKey } },
        data: { lastNo: nextLastNo }
      });
    } else if (corpPrefix && skuCode) {
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
  generateEpcBatch,
  exportBatchXlsx,
  exportBatchVerifyUrlXlsx,
  exportBatchProductionTemplateXlsx,
  exportBatchImportTemplateXlsx,
  exportItemsXlsx,
  listBatches,
  listItems,
  deleteItems,
  getItemByEpc,
  resetItemsProduction,
  updateItemProduction,
  importProductionXlsx,
  previewBatchImportXlsx,
  createImportBatchFromXlsx,
  submitBatchImport,
  markProductionDone,
  updateBatch,
  deleteBatch,
  importExistingEpc,
  recalculateCorpSequence,
  deleteAllBatches,
  deleteAllGeneratedBatches
};
