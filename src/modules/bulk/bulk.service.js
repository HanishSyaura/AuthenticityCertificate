const XLSX = require('xlsx');

const jobQueue = require('../../services/jobQueue.service');
const certificateService = require('../certificate/certificate.service');
const prisma = require('../../config/prisma');

function normalizeRow(row) {
  const certificateId = String(row.certificateId || row.certificate_id || row.CERTIFICATE_ID || row.CertificateId || '').trim();
  const nfcUid = String(row.nfcUid || row.nfc_uid || row.NFC_UID || row.NFCUID || '').trim() || null;
  const epc = String(row.epc || row.EPC || '').trim() || null;
  const expiresAt = String(row.expiresAt || row.expires_at || row.EXPIRES_AT || '').trim() || null;
  return { certificateId, nfcUid, epc, expiresAt };
}

function parseXlsxBase64(base64, { sheetName } = {}) {
  const buf = Buffer.from(String(base64 || ''), 'base64');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const name = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) return { sheetName: name || null, rows: [] };
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = json.map(normalizeRow).filter((r) => r.certificateId);
  return { sheetName: name, rows };
}

function parseWorkbookBase64(base64) {
  const buf = Buffer.from(String(base64 || ''), 'base64');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheets = {};
  for (const name of wb.SheetNames || []) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    sheets[String(name).trim().toLowerCase()] = rows;
  }
  return sheets;
}

async function handleBulkImportXlsx({ organizationId, sheets, dryRun }) {
  const orgId = Number(organizationId);
  const result = {
    dryRun: Boolean(dryRun),
    products: { requested: 0, created: 0, updated: 0, failed: [] },
    batches: { requested: 0, created: 0, updated: 0, failed: [] },
    certificates: { requested: 0, created: 0, failed: [] },
    identities: { requested: 0, success: 0, failed: [] }
  };

  const products = Array.isArray(sheets.products) ? sheets.products : [];
  result.products.requested = products.length;
  for (const row of products) {
    const code = String(row.code || row.Code || '').trim();
    const name = String(row.name || row.Name || '').trim();
    if (!code || !name) {
      result.products.failed.push({ row, error: 'Missing product code/name' });
      continue;
    }
    const origin = String(row.origin || row.Origin || '').trim() || null;
    const description = String(row.description || row.Description || '').trim() || null;
    const cmsPageId = row.cmsPageId ? Number(row.cmsPageId) : null;
    const certificateTemplateId = row.certificateTemplateId ? Number(row.certificateTemplateId) : null;

    try {
      const existing = await prisma.product.findFirst({ where: { organizationId: orgId, code, deletedAt: null } });
      if (dryRun) {
        if (existing) result.products.updated++;
        else result.products.created++;
        continue;
      }
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { name, origin, description, cmsPageId, certificateTemplateId }
        });
        result.products.updated++;
      } else {
        await prisma.product.create({
          data: { organizationId: orgId, code, name, origin, description, cmsPageId, certificateTemplateId }
        });
        result.products.created++;
      }
    } catch (e) {
      result.products.failed.push({ row, error: e?.message || String(e) });
    }
  }

  const batches = Array.isArray(sheets.batches) ? sheets.batches : [];
  result.batches.requested = batches.length;
  for (const row of batches) {
    const batchNo = String(row.batchNo || row.batch_no || row.BatchNo || '').trim();
    const productCode = String(row.productCode || row.product_code || row.ProductCode || '').trim();
    if (!batchNo || !productCode) {
      result.batches.failed.push({ row, error: 'Missing batchNo/productCode' });
      continue;
    }
    try {
      const product = await prisma.product.findFirst({ where: { organizationId: orgId, code: productCode, deletedAt: null } });
      if (!product) throw new Error('Product not found for batch');
      const existing = await prisma.batch.findFirst({ where: { organizationId: orgId, batchNo, deletedAt: null } });
      if (dryRun) {
        if (existing) result.batches.updated++;
        else result.batches.created++;
        continue;
      }
      if (existing) {
        await prisma.batch.update({ where: { id: existing.id }, data: { productId: product.id } });
        result.batches.updated++;
      } else {
        await prisma.batch.create({ data: { organizationId: orgId, batchNo, productId: product.id } });
        result.batches.created++;
      }
    } catch (e) {
      result.batches.failed.push({ row, error: e?.message || String(e) });
    }
  }

  const certs = Array.isArray(sheets.certificates) ? sheets.certificates : [];
  result.certificates.requested = certs.length;
  for (const row of certs) {
    const certificateId = String(row.certificateId || row.certificate_id || row.CertificateId || '').trim();
    const batchNo = String(row.batchNo || row.batch_no || row.BatchNo || '').trim();
    const type = String(row.type || row.Type || '').trim().toLowerCase();
    if (!batchNo || (type !== 'batch' && type !== 'unit')) {
      result.certificates.failed.push({ row, error: 'Missing batchNo or invalid type' });
      continue;
    }
    try {
      const batch = await prisma.batch.findFirst({ where: { organizationId: orgId, batchNo, deletedAt: null } });
      if (!batch) throw new Error('Batch not found for certificate');

      if (dryRun) {
        result.certificates.created++;
        continue;
      }

      if (certificateId) {
        await prisma.certificate.create({
          data: {
            certificateId,
            organizationId: orgId,
            type,
            status: 'PENDING',
            batchId: batch.id
          }
        });
        result.certificates.created++;
      } else {
        const generated = await certificateService.generateCertificates(batch.id, type, 1, orgId);
        result.certificates.created += Array.isArray(generated) ? generated.length : 1;
      }
    } catch (e) {
      result.certificates.failed.push({ row, error: e?.message || String(e) });
    }
  }

  const ids = Array.isArray(sheets.identities) ? sheets.identities : [];
  result.identities.requested = ids.length;
  for (const raw of ids) {
    const r = normalizeRow(raw);
    if (!r.certificateId) {
      result.identities.failed.push({ row: raw, error: 'Missing certificateId' });
      continue;
    }
    try {
      if (dryRun) {
        result.identities.success++;
        continue;
      }
      await certificateService.activateCertificate({
        organizationId: orgId,
        certificateId: r.certificateId,
        nfcUid: r.nfcUid,
        epc: r.epc,
        expiresAt: r.expiresAt || undefined
      });
      result.identities.success++;
    } catch (e) {
      result.identities.failed.push({ row: raw, error: e?.message || String(e) });
    }
  }

  return result;
}

async function handleBulkGenerate({ organizationId, batchId, type, quantity }) {
  const certs = await certificateService.generateCertificates(batchId, type, quantity, organizationId);
  return { count: certs.length, certificates: certs.map((c) => c.certificateId || c) };
}

async function handleBulkRevoke({ organizationId, certificateIds }) {
  const ids = Array.isArray(certificateIds) ? certificateIds : [];
  let success = 0;
  const failed = [];
  for (const id of ids) {
    try {
      await certificateService.revokeCertificate(String(id), organizationId);
      success++;
    } catch (e) {
      failed.push({ certificateId: String(id), error: e?.message || String(e) });
    }
  }
  return { requested: ids.length, success, failed };
}

async function handleBulkAssign({ organizationId, rows }) {
  const list = Array.isArray(rows) ? rows : [];
  let success = 0;
  const failed = [];
  for (const raw of list) {
    const r = normalizeRow(raw);
    if (!r.certificateId) continue;
    try {
      await certificateService.activateCertificate({
        organizationId,
        certificateId: r.certificateId,
        nfcUid: r.nfcUid,
        epc: r.epc,
        expiresAt: r.expiresAt || undefined
      });
      success++;
    } catch (e) {
      failed.push({ certificateId: r.certificateId, error: e?.message || String(e) });
    }
  }
  return { requested: list.length, success, failed };
}

function registerHandlers() {
  jobQueue.registerHandler('bulk_generate', handleBulkGenerate);
  jobQueue.registerHandler('bulk_revoke', handleBulkRevoke);
  jobQueue.registerHandler('bulk_assign', handleBulkAssign);
  jobQueue.registerHandler('bulk_import_xlsx', handleBulkImportXlsx);
}

module.exports = {
  registerHandlers,
  parseXlsxBase64,
  parseWorkbookBase64,
  handleBulkGenerate,
  handleBulkRevoke,
  handleBulkAssign,
  handleBulkImportXlsx
};
