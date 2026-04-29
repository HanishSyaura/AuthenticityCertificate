const certificateService = require('./certificate.service');
const { z } = require('zod');

const generateSchema = z.object({
  batchId: z.number().int(),
  type: z.enum(['batch', 'unit']),
  quantity: z.number().int().min(1).optional()
});

const assignSchema = z.object({
  certificateId: z.string().min(1),
  nfcUid: z.string().min(1).optional(),
  epc: z.string().min(1).optional(),
  expiresAt: z.string().min(1).optional()
});

const reissueSchema = z.object({
  certificateId: z.string().min(1),
  reason: z.string().min(1).optional()
});

async function generate(req, res) {
  try {
    const validatedData = generateSchema.parse(req.body);
    const certificates = await certificateService.generateCertificates(
      validatedData.batchId,
      validatedData.type,
      validatedData.quantity,
      req.organization.id
    );
    res.success(certificates, `Successfully generated ${certificates.length} certificates`);
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function revoke(req, res) {
  try {
    const { id } = req.params;
    const cert = await certificateService.revokeCertificate(id, req.organization.id);
    res.success(cert, 'Certificate revoked successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function assign(req, res) {
  try {
    const data = assignSchema.parse(req.body);
    const result = await certificateService.activateCertificate({
      organizationId: req.organization.id,
      certificateId: data.certificateId,
      nfcUid: data.nfcUid,
      epc: data.epc,
      expiresAt: data.expiresAt
    });
    res.success(result, 'Identity assigned');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function reissue(req, res) {
  try {
    const data = reissueSchema.parse(req.body);
    const result = await certificateService.reissueCertificate({
      organizationId: req.organization.id,
      certificateId: data.certificateId,
      reason: data.reason
    });
    res.success(result, 'Certificate reissued');
  } catch (error) {
    res.error(error.message, 400);
  }
}

function parseLimit(req) {
  const limit = Number(req.query.limit || 50);
  return Math.max(1, Math.min(200, limit));
}

function parseOffset(req) {
  const offset = Number(req.query.offset || 0);
  return Math.max(0, offset);
}

async function list(req, res) {
  try {
    const limit = parseLimit(req);
    const offset = parseOffset(req);
    const q = req.query.q ? String(req.query.q) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const type = req.query.type ? String(req.query.type) : null;
    const batchNo = req.query.batchNo ? String(req.query.batchNo) : null;
    const productCode = req.query.productCode ? String(req.query.productCode) : null;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    const result = await certificateService.listCertificates({
      organizationId: req.organization.id,
      q,
      status,
      type,
      batchNo,
      productCode,
      from,
      to,
      limit,
      offset
    });

    res.success(result);
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function get(req, res) {
  try {
    const { id } = req.params;
    const cert = await certificateService.getCertificateDetailsForAdmin({ organizationId: req.organization.id, certificateId: id });
    res.success(cert);
  } catch (error) {
    res.error(error.message, 400);
  }
}

module.exports = {
  list,
  get,
  generate,
  revoke,
  assign,
  reissue
};
