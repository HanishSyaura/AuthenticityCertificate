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

module.exports = {
  generate,
  revoke,
  assign,
  reissue
};
