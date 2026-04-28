const scanlog = require('../../services/scanlog.service');
const certificateService = require('../certificate/certificate.service');

function parseLimit(req) {
  const limit = Number(req.query.limit || 200);
  return Math.max(1, Math.min(1000, limit));
}

function parseOffset(req) {
  const offset = Number(req.query.offset || 0);
  return Math.max(0, offset);
}

async function overview(req, res) {
  res.success(scanlog.overview());
}

async function scans(req, res) {
  const limit = parseLimit(req);
  const offset = parseOffset(req);
  res.success(scanlog.listScans({ limit, offset }));
}

async function certificateTimeline(req, res) {
  const { id } = req.params;
  const timeline = scanlog.getCertificateTimeline(id);
  let cert = null;
  try {
    cert = await certificateService.getCertificateDetails(id);
  } catch {
  }
  res.success({
    ...timeline,
    certificate: cert
      ? {
          certificateId: cert.certificateId,
          type: cert.type,
          status: cert.status,
          issuedAt: cert.createdAt,
          product: cert.batch?.product
            ? {
                name: cert.batch.product.name,
                code: cert.batch.product.code
              }
            : null,
          batch: cert.batch ? { batchNo: cert.batch.batchNo } : null
        }
      : null
  });
}

async function setStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = new Set(['VALID', 'SUSPICIOUS', 'REVOKED', null]);
  const next = status === undefined ? null : status;
  if (!allowed.has(next)) return res.error('Invalid status', 400);

  const applied = scanlog.setCertificateStatusOverride(id, next);
  res.success({ certificateId: id, overrideStatus: applied });
}

module.exports = {
  overview,
  scans,
  certificateTimeline,
  setStatus
};

