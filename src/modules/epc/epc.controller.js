const { z } = require('zod');
const epcService = require('./epc.service');

const generateSchema = z.object({
  corpPrefix: z.string().min(1),
  productId: z.number().int().positive(),
  batchName: z.string().min(1),
  batchQty: z.number().int().positive().max(5000),
  remark: z.string().optional(),
  certificateTemplateId: z.number().int().nullable().optional(),
  templateData: z.record(z.string(), z.unknown()).optional()
});

const importProductionSchema = z.object({
  base64: z.string().min(1)
});

const importExistingSchema = z.object({
  productId: z.number().int().positive(),
  batchName: z.string().optional(),
  base64: z.string().min(1)
});

const updateBatchSchema = z.object({
  certificateTemplateId: z.number().int().nullable().optional()
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
    const validated = generateSchema.parse(req.body || {});
    const result = await epcService.generateEpcBatch({
      organizationId: req.organization.id,
      corpPrefix: validated.corpPrefix,
      productId: validated.productId,
      batchName: validated.batchName,
      batchQty: validated.batchQty,
      remark: validated.remark,
      certificateTemplateId: validated.certificateTemplateId,
      templateData: validated.templateData
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

async function importProductionXlsx(req, res) {
  try {
    const batchId = Number(req.params.id);
    const data = importProductionSchema.parse(req.body);
    const result = await epcService.importProductionXlsx({ organizationId: req.organization.id, batchId, base64: data.base64 });
    res.success(result, 'Production file imported');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function markProductionDone(req, res) {
  try {
    const batchId = Number(req.params.id);
    const result = await epcService.markProductionDone({ organizationId: req.organization.id, batchId });
    res.success(result, 'Production marked done');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function deleteBatch(req, res) {
  try {
    const batchId = Number(req.params.id);
    const result = await epcService.deleteBatch({ organizationId: req.organization.id, batchId });
    res.success(result, 'Batch deleted');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function updateBatch(req, res) {
  try {
    const batchId = Number(req.params.id);
    const data = updateBatchSchema.parse(req.body);
    const updated = await epcService.updateBatch({ organizationId: req.organization.id, batchId, patch: data });
    res.success(updated, 'Batch updated');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function importExisting(req, res) {
  try {
    const data = importExistingSchema.parse(req.body);
    const result = await epcService.importExistingEpc({
      organizationId: req.organization.id,
      productId: data.productId,
      batchName: data.batchName,
      base64: data.base64
    });
    res.success(result, 'Existing EPC imported');
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
  exportBatch,
  importProductionXlsx,
  markProductionDone,
  updateBatch,
  deleteBatch,
  importExisting
};
