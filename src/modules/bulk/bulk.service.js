const XLSX = require('xlsx');

const jobQueue = require('../../services/jobQueue.service');
const certificateService = require('../certificate/certificate.service');

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
}

module.exports = {
  registerHandlers,
  parseXlsxBase64,
  handleBulkGenerate,
  handleBulkRevoke,
  handleBulkAssign
};

