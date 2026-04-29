const { z } = require('zod');
const epcService = require('./epc.service');

const generateSchema = z.object({
  corpPrefix: z.string().min(1),
  productId: z.number().int().positive(),
  batchName: z.string().min(1),
  batchQty: z.number().int().positive().max(5000),
  remark: z.string().optional()
});

function parseLimitOffset(q) {
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
  const offset = Math.max(Number(q.offset) || 0, 0);
  return { limit, offset };
}

async function getCorpCodes(req, res) {
  try {
    const codes = epcService.getAllowedCorpPrefixes();
    res.success(codes);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function generateBatch(req, res) {
  try {
    const validated = generateSchema.parse(req.body);
    const result = await epcService.generateEpcBatch({
      organizationId: req.organization.id,
      corpPrefix: validated.corpPrefix,
      productId: validated.productId,
      batchName: validated.batchName,
      batchQty: validated.batchQty,
      remark: validated.remark
    });
    res.success(result, 'EPC batch generated');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function listBatches(req, res) {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const data = await epcService.listBatches({ organizationId: req.organization.id, q, limit, offset });
    res.success(data);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function listItems(req, res) {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const batchId = req.query.batchId ? Number(req.query.batchId) : null;
    const data = await epcService.listItems({ organizationId: req.organization.id, q, batchId, limit, offset });
    res.success(data);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function listBatchItems(req, res) {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const batchId = Number(req.params.id);
    const data = await epcService.listItems({ organizationId: req.organization.id, q: '', batchId, limit, offset });
    res.success(data);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function exportBatch(req, res) {
  try {
    const batchId = Number(req.params.id);
    const { buffer, filename } = await epcService.exportBatchXlsx({ organizationId: req.organization.id, batchId });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (e) {
    res.error(e.message, 400);
  }
}

module.exports = {
  getCorpCodes,
  generateBatch,
  listBatches,
  listItems,
  listBatchItems,
  exportBatch
};
