const { z } = require('zod');
const epcService = require('./epc.service');

const generateSchema = z.object({
  corpPrefix: z.string().min(1),
  productId: z.number().int().positive(),
  productionDate: z
    .string()
    .optional()
    .refine((v) => v == null || !Number.isNaN(new Date(v).getTime()), 'Invalid productionDate'),
  batchName: z.string().min(1),
  batchQty: z.number().int().positive().max(5000),
  remark: z.string().optional(),
  certificateId: z.string().trim().min(1).optional(),
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
  certificateTemplateId: z.number().int().nullable().optional(),
  remark: z.union([z.string(), z.null()]).optional(),
  templateData: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
  productionDate: z
    .union([z.string(), z.null()])
    .optional()
    .refine((v) => v == null || !Number.isNaN(new Date(v).getTime()), 'Invalid productionDate')
});

const recalcSequenceSchema = z.object({
  corpPrefix: z.string().min(1)
});

const deleteAllSchema = z.object({
  corpPrefix: z.string().min(1).optional()
});

const getItemByEpcSchema = z.object({
  epc: z.string().trim().min(1)
});

const updateItemProductionSchema = z.object({
  netWeight: z.union([z.string(), z.number(), z.null()]).optional(),
  caiqNumber: z.union([z.string(), z.number(), z.null()]).optional(),
  productionDate: z.union([z.string(), z.null()]).optional(),
  batchId: z.coerce.number().int().positive().optional()
});

const resetItemsProductionSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1).max(500)
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

async function getNextCertificateId(req, res) {
  try {
    const certificateId = await epcService.getNextCertificateId({ organizationId: req.organization.id });
    res.success({ certificateId });
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
      productionDate: validated.productionDate,
      batchName: validated.batchName,
      batchQty: validated.batchQty,
      remark: validated.remark,
      certificateId: validated.certificateId,
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
    const pendingOnly = String(req.query.pending || '').trim() === '1';
    const data = await epcService.listItems({ organizationId: req.organization.id, q, batchId, pendingOnly, limit, offset });
    res.success(data);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function listBatchItems(req, res) {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const batchId = Number(req.params.id);
    const pendingOnly = String(req.query.pending || '').trim() === '1';
    const data = await epcService.listItems({ organizationId: req.organization.id, q: '', batchId, pendingOnly, limit, offset });
    res.success(data);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function getItemByEpc(req, res) {
  try {
    const data = getItemByEpcSchema.parse({ epc: req.query?.epc });
    const item = await epcService.getItemByEpc({ organizationId: req.organization.id, epcCode: data.epc });
    res.success(item);
  } catch (e) {
    const status = Number(e.status) || 400;
    res.error(e.message, status);
  }
}

async function updateItemProduction(req, res) {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isFinite(itemId) || itemId <= 0) return res.error('Invalid item id', 400);

    const parsed = updateItemProductionSchema.parse(req.body || {});
    const expectedBatchId = Object.prototype.hasOwnProperty.call(parsed, 'batchId') ? parsed.batchId : undefined;
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(parsed, 'netWeight')) {
      const v = parsed.netWeight;
      patch.netWeight = v == null ? null : String(v).trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'caiqNumber')) {
      const v = parsed.caiqNumber;
      patch.caiqNumber = v == null ? null : String(v).trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'productionDate')) {
      const v = parsed.productionDate;
      patch.productionDate = v ? new Date(String(v)) : null;
      if (patch.productionDate && Number.isNaN(patch.productionDate.getTime())) return res.error('Invalid productionDate', 400);
    }

    if (Object.keys(patch).length === 0) return res.error('No fields to update', 400);

    const updated = await epcService.updateItemProduction({
      organizationId: req.organization.id,
      itemId,
      patch,
      expectedBatchId,
      actor: req.user
    });
    res.success(updated, 'Item updated');
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.error('Invalid input. Please check Net Weight and CAIQ values and try again.', 400);
    }
    const status = Number(e.status) || 400;
    res.error(e.message, status);
  }
}

async function resetItemsProduction(req, res) {
  try {
    const data = resetItemsProductionSchema.parse(req.body || {});
    const result = await epcService.resetItemsProduction({
      organizationId: req.organization.id,
      itemIds: data.itemIds,
      actor: req.user
    });
    res.success(result, 'Production fields cleared');
  } catch (e) {
    if (e instanceof z.ZodError) {
      const first = e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input';
      return res.error(first, 400);
    }
    const status = Number(e.status) || 400;
    res.error(e.message, status);
  }
}

async function exportBatch(req, res) {
  try {
    const batchId = Number(req.params.id);
    const raw = req.query?.columns;
    const parts = Array.isArray(raw) ? raw : String(raw || '').split(',');
    const columns = parts.map((s) => String(s).trim()).filter(Boolean);
    const { buffer, filename } = await epcService.exportBatchXlsx({ organizationId: req.organization.id, batchId, columns });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function exportBatchVerifyUrls(req, res) {
  try {
    const batchId = Number(req.params.id);
    const verifyUrlPrefix = (process.env.PUBLIC_VERIFY_URL_PREFIX || '').trim() || 'https://wmscertauth.clbgroups.com/verify?epc=';
    const { buffer, filename } = await epcService.exportBatchVerifyUrlXlsx({
      organizationId: req.organization.id,
      batchId,
      verifyUrlPrefix
    });
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
    const updated = await epcService.updateBatch({ organizationId: req.organization.id, batchId, patch: data, actor: req.user });
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

async function recalculateSequence(req, res) {
  try {
    const data = recalcSequenceSchema.parse(req.body || {});
    const result = await epcService.recalculateCorpSequence({ organizationId: req.organization.id, corpPrefix: data.corpPrefix });
    res.success(result, 'Sequence recalculated');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function deleteAll(req, res) {
  try {
    const data = deleteAllSchema.parse(req.body || {});
    const result = await epcService.deleteAllBatches({ organizationId: req.organization.id, corpPrefix: data.corpPrefix });
    res.success(result, 'All EPC batches deleted');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

module.exports = {
  getCorpCodes,
  getNextCertificateId,
  generateBatch,
  listBatches,
  listItems,
  getItemByEpc,
  resetItemsProduction,
  updateItemProduction,
  listBatchItems,
  exportBatch,
  exportBatchVerifyUrls,
  importProductionXlsx,
  markProductionDone,
  updateBatch,
  deleteBatch,
  importExisting,
  recalculateSequence,
  deleteAll
};
