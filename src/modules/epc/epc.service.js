const prisma = require('../../config/prisma');
const XLSX = require('xlsx');
const { generateCertificateId } = require('../../utils/id-generator');

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
  const expectedMinLen = prefix.length + 4 + padLen;
  if (code.length < expectedMinLen) throw new Error('EPC code too short');

  const run = code.slice(code.length - padLen);
  if (!/^\d+$/.test(run)) throw new Error('Invalid running number in EPC code');

  const mmyy = code.slice(code.length - (padLen + 4), code.length - padLen);
  if (!/^\d{4}$/.test(mmyy)) throw new Error('Invalid MMYY in EPC code');
  const mm = Number(mmyy.slice(0, 2));
  if (!Number.isFinite(mm) || mm < 1 || mm > 12) throw new Error('Invalid month in EPC code');

  return BigInt(run);
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

    for (const p of prefixes) {
      await tx.corpSequence.upsert({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix: p } },
        update: {},
        create: { organizationId: orgId, corpPrefix: p, lastNo: 0n }
      });
      const maxExisting = await tx.epcItem.findFirst({
        where: { organizationId: orgId, batch: { corpPrefix: p } },
        orderBy: { runningNo: 'desc' },
        select: { runningNo: true }
      });
      const nextLastNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
      await tx.corpSequence.update({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix: p } },
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

async function generateEpcBatch({ organizationId, corpPrefix, productId, productionDate, batchName, batchQty, remark, certificateTemplateId, templateData }) {
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

  const result = await prisma.$transaction(
    async (tx) => {
      const appBatch = await tx.batch.upsert({
        where: { organizationId_batchNo: { organizationId: orgId, batchNo: batchName } },
        update: { productId: prodId },
        create: { organizationId: orgId, batchNo: batchName, productId: prodId },
        select: { id: true }
      });

      await tx.corpSequence.upsert({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix } },
        update: {},
        create: { organizationId: orgId, corpPrefix, lastNo: 0n }
      });

      let batchCertId = null;
      const existingBatchCert = await tx.certificate.findFirst({
        where: { organizationId: orgId, batchId: appBatch.id, type: 'batch', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { certificateId: true }
      });
      if (existingBatchCert?.certificateId) {
        batchCertId = String(existingBatchCert.certificateId);
      } else {
        batchCertId = generateCertificateId();
        await tx.certificate.create({
          data: {
            certificateId: batchCertId,
            organizationId: orgId,
            type: 'batch',
            batchId: appBatch.id,
            status: 'VALID',
            issuedAt: new Date()
          }
        });
      }

      const rows = await tx.$queryRaw`
        SELECT lastNo FROM \`CorpSequence\`
        WHERE organizationId = ${orgId} AND corpPrefix = ${corpPrefix}
        FOR UPDATE
      `;

      const current = rows && rows[0] && rows[0].lastNo !== undefined ? BigInt(rows[0].lastNo) : 0n;
      const maxExisting = await tx.epcItem.findFirst({
        where: { organizationId: orgId, batch: { corpPrefix } },
        orderBy: { runningNo: 'desc' },
        select: { runningNo: true }
      });
      const maxExistingNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
      const baseNo = current > maxExistingNo ? current : maxExistingNo;
      const startNo = baseNo + 1n;
      const endNo = baseNo + BigInt(batchQty);
      await tx.corpSequence.update({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix } },
        data: { lastNo: endNo }
      });


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
          certificateTemplateId: typeof certificateTemplateId === 'number' ? certificateTemplateId : null,
          templateData: templateData || null,
          productionUploadedAt: null,
          productionDoneAt: null
        },
        include: {
          product: { select: { id: true, sku: true, name: true, code: true } }
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

  const { rows } = parseXlsxBase64(base64);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Excel kosong');

  const items = [];
  let maxRun = 0n;
  for (const r of rows) {
    const n = normalizeRowKeys(r);
    const epcCode = String(n.epccode || n.epc || n.code || '').trim();
    if (!epcCode) continue;
    const runningNo = parseRunningNoFromEpcCode({ epcCode, corpPrefix });
    if (runningNo > maxRun) maxRun = runningNo;
    items.push({
      epcCode,
      runningNo
    });
  }
  if (items.length === 0) throw new Error('Tiada EPC code dalam Excel');

  const name = String(batchName || '').trim() || `import_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.corpSequence.upsert({
      where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix } },
      update: {},
      create: { organizationId: orgId, corpPrefix, lastNo: 0n }
    });

    const appBatch = await tx.batch.upsert({
      where: { organizationId_batchNo: { organizationId: orgId, batchNo: name } },
      update: { productId: prodId },
      create: { organizationId: orgId, batchNo: name, productId: prodId },
      select: { id: true }
    });

    let batchCertId = null;
    const existingBatchCert = await tx.certificate.findFirst({
      where: { organizationId: orgId, batchId: appBatch.id, type: 'batch', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { certificateId: true }
    });
    if (existingBatchCert?.certificateId) {
      batchCertId = String(existingBatchCert.certificateId);
    } else {
      batchCertId = generateCertificateId();
      await tx.certificate.create({
        data: {
          certificateId: batchCertId,
          organizationId: orgId,
          type: 'batch',
          batchId: appBatch.id,
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
      include: { product: { select: { id: true, sku: true, name: true, code: true } } }
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
      WHERE organizationId = ${orgId} AND corpPrefix = ${corpPrefix}
      FOR UPDATE
    `;
    const current = rows2 && rows2[0] && rows2[0].lastNo !== undefined ? BigInt(rows2[0].lastNo) : 0n;
    const nextLast = current > maxRun ? current : maxRun;
    if (nextLast !== current) {
      await tx.corpSequence.update({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix } },
        data: { lastNo: nextLast }
      });
    }

    const inserted = await tx.epcItem.count({ where: { organizationId: orgId, batchId: batch.id } });
    return { batch, rows: items.length, inserted, lastNo: nextLast.toString() };
  });

  return result;
}

async function exportBatchXlsx({ organizationId, batchId }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');

  const batch = await withTimeout(
    prisma.epcBatch.findFirst({
      where: { id, organizationId: orgId },
      include: { product: { select: { id: true, sku: true, name: true, code: true } } }
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

  const header = [
    { key: 'corpPrefix', value: batch.corpPrefix },
    { key: 'batchName', value: batch.batchName },
    { key: 'batchQty', value: batch.batchQty },
    { key: 'product', value: batch.product?.name || '' },
    { key: 'sku', value: batch.sku || batch.product?.sku || '' },
    { key: 'certificateId', value: batch.certificateId || '' }
  ];

  const wsInfo = XLSX.utils.json_to_sheet(header, { header: ['key', 'value'] });
  const wsItems = XLSX.utils.json_to_sheet(
    items.map((it) => ({
      epcCode: it.epcCode,
      netWeight: it.netWeight || '',
      productionDate: it.productionDate ? new Date(it.productionDate).toISOString().slice(0, 10) : '',
      caiqNumber: it.caiqNumber || ''
    }))
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsInfo, 'batch');
  XLSX.utils.book_append_sheet(wb, wsItems, 'epc');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const safeBatch = String(batch.batchName || 'batch').replace(/[^\w.-]+/g, '_').slice(0, 64);
  const filename = `epc_${safeBatch}_${batch.id}.xlsx`;
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
        include: { product: { select: { id: true, sku: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
    ]),
    2500
  );

  return { items, total, limit, offset };
}

async function listItems({ organizationId, q, batchId, limit, offset }) {
  const orgId = Number(organizationId);
  const where = {
    organizationId: orgId,
    ...(batchId ? { batchId: Number(batchId) } : {}),
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
    await tx.epcItem.deleteMany({ where: { organizationId: orgId, batchId: id } });
    await tx.epcBatch.delete({ where: { id } });
    if (corpPrefix) {
      await tx.corpSequence.upsert({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix } },
        update: {},
        create: { organizationId: orgId, corpPrefix, lastNo: 0n }
      });
      const maxExisting = await tx.epcItem.findFirst({
        where: { organizationId: orgId, batch: { corpPrefix } },
        orderBy: { runningNo: 'desc' },
        select: { runningNo: true }
      });
      const nextLastNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
      await tx.corpSequence.update({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix } },
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
    await tx.corpSequence.upsert({
      where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix: prefix } },
      update: {},
      create: { organizationId: orgId, corpPrefix: prefix, lastNo: 0n }
    });
    const maxExisting = await tx.epcItem.findFirst({
      where: { organizationId: orgId, batch: { corpPrefix: prefix } },
      orderBy: { runningNo: 'desc' },
      select: { runningNo: true }
    });
    const nextLastNo = maxExisting?.runningNo != null ? BigInt(maxExisting.runningNo) : 0n;
    const updated = await tx.corpSequence.update({
      where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix: prefix } },
      data: { lastNo: nextLastNo }
    });
    return { corpPrefix: prefix, lastNo: updated.lastNo };
  });
  return { corpPrefix: result.corpPrefix, lastNo: result.lastNo != null ? result.lastNo.toString() : '0' };
}

async function updateBatch({ organizationId, batchId, patch }) {
  const orgId = Number(organizationId);
  const id = Number(batchId);
  if (!Number.isFinite(id)) throw new Error('Invalid batch id');
  const data = {};
  if (patch.certificateTemplateId !== undefined) data.certificateTemplateId = patch.certificateTemplateId == null ? null : Number(patch.certificateTemplateId);
  const res = await withTimeout(
    prisma.epcBatch.updateMany({
      where: { id, organizationId: orgId },
      data
    }),
    1500
  );
  if (!res.count) throw new Error('Batch tidak dijumpai');
  return await withTimeout(prisma.epcBatch.findFirst({ where: { id, organizationId: orgId }, include: { product: { select: { id: true, sku: true, name: true, code: true } } } }), 1500);
}

module.exports = {
  getAllowedCorpPrefixes,
  generateEpcBatch,
  exportBatchXlsx,
  listBatches,
  listItems,
  importProductionXlsx,
  markProductionDone,
  updateBatch,
  deleteBatch,
  importExistingEpc,
  recalculateCorpSequence,
  deleteAllBatches
};
