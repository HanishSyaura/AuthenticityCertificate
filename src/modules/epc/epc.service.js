const prisma = require('../../config/prisma');
const XLSX = require('xlsx');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function getAllowedCorpPrefixes() {
  const raw = process.env.CORP_PREFIXES || process.env.CORP_PREFIX || '';
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : ['DA01C'];
}

function getRunningPadLen() {
  const n = Number(process.env.EPC_RUNNING_PAD || 7);
  if (!Number.isFinite(n) || n < 1) return 7;
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
  const raw = String(product?.sku || '').trim();
  const digits = raw.replace(/\D+/g, '');
  if (digits) return digits.length >= 2 ? digits.slice(-2) : digits.padStart(2, '0');
  const fallback = String(product?.code || '').trim().replace(/\D+/g, '');
  if (fallback) return fallback.length >= 2 ? fallback.slice(-2) : fallback.padStart(2, '0');
  return '00';
}

function buildEpcCode({ corpPrefix, runningNo, skuCode, mmyy }) {
  const padLen = getRunningPadLen();
  const run = padRunningNo(runningNo, padLen);
  return `${corpPrefix}${run}${skuCode}${mmyy}${run}`;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function generateEpcBatch({ organizationId, corpPrefix, productId, batchName, batchQty, remark }) {
  const allowed = getAllowedCorpPrefixes();
  if (!allowed.includes(corpPrefix)) throw new Error('Corp code tidak dibenarkan');

  const orgId = Number(organizationId);
  const prodId = Number(productId);

  const product = await withTimeout(
    prisma.product.findFirst({ where: { id: prodId, organizationId: orgId, deletedAt: null } }),
    1200
  );
  if (!product) throw new Error('Product tidak dijumpai');
  const skuCode = normalizeSkuCode(product);
  const mmyy = formatMMyy(new Date());

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.batch.upsert({
        where: { organizationId_batchNo: { organizationId: orgId, batchNo: batchName } },
        update: { productId: prodId, deletedAt: null },
        create: { organizationId: orgId, batchNo: batchName, productId: prodId }
      });

      await tx.corpSequence.upsert({
        where: { organizationId_corpPrefix: { organizationId: orgId, corpPrefix } },
        update: {},
        create: { organizationId: orgId, corpPrefix, lastNo: 0n }
      });

      const rows = await tx.$queryRaw`
        SELECT lastNo FROM \`CorpSequence\`
        WHERE organizationId = ${orgId} AND corpPrefix = ${corpPrefix}
        FOR UPDATE
      `;

      const current = rows && rows[0] && rows[0].lastNo !== undefined ? BigInt(rows[0].lastNo) : 0n;
      const startNo = current + 1n;
      const endNo = current + BigInt(batchQty);

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
          remark: remark || null
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
          runningNo
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
      select: { epcCode: true, runningNo: true, createdAt: true }
    }),
    12_000
  );

  const header = [
    { key: 'corpPrefix', value: batch.corpPrefix },
    { key: 'batchName', value: batch.batchName },
    { key: 'batchQty', value: batch.batchQty },
    { key: 'product', value: batch.product?.name || '' },
    { key: 'sku', value: batch.sku || batch.product?.sku || '' }
  ];

  const wsInfo = XLSX.utils.json_to_sheet(header, { header: ['key', 'value'] });
  const wsItems = XLSX.utils.json_to_sheet(
    items.map((it) => ({
      epcCode: it.epcCode,
      runningNo: it.runningNo?.toString ? it.runningNo.toString() : String(it.runningNo),
      createdAt: it.createdAt ? new Date(it.createdAt).toISOString() : ''
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

module.exports = {
  getAllowedCorpPrefixes,
  generateEpcBatch,
  exportBatchXlsx,
  listBatches,
  listItems
};
