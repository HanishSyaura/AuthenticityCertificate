const { z } = require('zod');
const epcService = require('./epc.service');
const { matchPermission } = require('../../middleware/access.middleware');

const generateSchema = z.object({
  batchQty: z.number().int().positive().max(5000),
  remark: z.string().optional()
});

const importProductionSchema = z.object({
  base64: z.string().min(1)
});

const previewBatchImportSchema = z.object({
  base64: z.string().min(1)
});

const submitBatchImportSchema = z.object({
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
  productionDate: z.union([z.string(), z.null()]).optional()
});

const resetItemsProductionSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1).max(500)
});

const deleteItemsSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1).max(1000),
  cleanup: z.boolean().optional()
});

const exportItemsSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1).max(2000).optional(),
  q: z.string().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  batchId: z.number().int().positive().optional(),
  columns: z.array(z.string().min(1)).max(50).optional()
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

async function peekCertificateId(req, res) {
  try {
    const certificateId = await epcService.peekCertificateId({ organizationId: req.organization.id });
    res.success({ certificateId });
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function generateBatch(req, res) {
  try {
    const validated = generateSchema.parse(req.body || {});
    const corpPrefix = epcService.getAllowedCorpPrefixes()[0] || 'DA01';
    const result = await epcService.generateEpcBatch({
      organizationId: req.organization.id,
      corpPrefix,
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
    const origin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
    const data = await epcService.listBatches({ organizationId: req.organization.id, q, origin, limit, offset });
    res.success(data);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function getEpcStats(req, res) {
  try {
    const data = await epcService.getEpcStats({ organizationId: req.organization.id });
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
    const fromRaw = typeof req.query.createdFrom === 'string' ? req.query.createdFrom.trim() : '';
    const toRaw = typeof req.query.createdTo === 'string' ? req.query.createdTo.trim() : '';
    const createdFrom = fromRaw ? new Date(fromRaw) : null;
    const createdTo = toRaw ? new Date(toRaw) : null;
    if (createdFrom && Number.isNaN(createdFrom.getTime())) return res.error('Invalid createdFrom', 400);
    if (createdTo && Number.isNaN(createdTo.getTime())) return res.error('Invalid createdTo', 400);

    const data = await epcService.listItems({
      organizationId: req.organization.id,
      q,
      batchId,
      pendingOnly,
      createdFrom,
      createdTo,
      limit,
      offset
    });
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

async function exportItems(req, res) {
  try {
    const data = exportItemsSchema.parse(req.body || {});
    const cols = Array.isArray(data.columns) ? data.columns.map((s) => String(s || '').trim()).filter(Boolean) : [];
    const ids = Array.isArray(data.itemIds) ? data.itemIds : [];
    const q = typeof data.q === 'string' ? data.q.trim() : '';
    const fromRaw = typeof data.createdFrom === 'string' ? data.createdFrom.trim() : '';
    const toRaw = typeof data.createdTo === 'string' ? data.createdTo.trim() : '';
    const batchId = data.batchId != null ? Number(data.batchId) : null;
    const createdFrom = fromRaw ? new Date(fromRaw) : null;
    const createdTo = toRaw ? new Date(toRaw) : null;
    if (createdFrom && Number.isNaN(createdFrom.getTime())) return res.error('Invalid createdFrom', 400);
    if (createdTo && Number.isNaN(createdTo.getTime())) return res.error('Invalid createdTo', 400);

    const { buffer, filename } = await epcService.exportItemsXlsx({
      organizationId: req.organization.id,
      itemIds: ids.length ? ids : null,
      q,
      createdFrom,
      createdTo,
      batchId,
      columns: cols
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function deleteItems(req, res) {
  try {
    const data = deleteItemsSchema.parse(req.body || {});
    const owned = req.user?.permissions || [];
    if (!matchPermission(owned, 'epc.delete')) return res.error('Insufficient permissions', 403);
    if (data.cleanup === true && !matchPermission(owned, 'epc.cleanup.delete')) return res.error('Insufficient permissions', 403);
    const result = await epcService.deleteItems({ organizationId: req.organization.id, itemIds: data.itemIds, cleanup: data.cleanup });
    res.success(result, 'EPC items deleted');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
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

async function exportBatchProductionTemplate(req, res) {
  try {
    const batchId = Number(req.params.id);
    const { buffer, filename } = await epcService.exportBatchProductionTemplateXlsx({ organizationId: req.organization.id, batchId });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function exportBatchImportTemplate(req, res) {
  try {
    const { buffer, filename } = await epcService.exportBatchImportTemplateXlsx();
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

async function previewBatchImport(req, res) {
  try {
    const batchId = Number(req.params.id);
    const data = previewBatchImportSchema.parse(req.body);
    const result = await epcService.previewBatchImportXlsx({ organizationId: req.organization.id, batchId, base64: data.base64 });
    res.success(result);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function previewBatchImportNew(req, res) {
  try {
    const data = previewBatchImportSchema.parse(req.body);
    const result = await epcService.previewBatchImportXlsx({ organizationId: req.organization.id, batchId: null, base64: data.base64 });
    res.success(result);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function submitBatchImport(req, res) {
  try {
    const data = submitBatchImportSchema.parse(req.body);
    const result = await epcService.createImportBatchFromXlsx({
      organizationId: req.organization.id,
      base64: data.base64,
      productId: null,
      sku: null,
      certificateTemplateId: undefined,
      documents: {}
    });
    res.success(result, 'Batch import saved');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error('Invalid input. Please check the form and try again.', 400);
    res.error(e.message, 400);
  }
}

async function submitBatchImportNew(req, res) {
  try {
    const data = submitBatchImportSchema.parse(req.body);
    const result = await epcService.createImportBatchFromXlsx({
      organizationId: req.organization.id,
      base64: data.base64,
      productId: null,
      sku: null,
      certificateTemplateId: undefined,
      documents: {}
    });
    res.success(result, 'Batch import saved');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error('Invalid input. Please check the form and try again.', 400);
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

async function deleteAllGenerated(req, res) {
  try {
    const data = deleteAllSchema.parse(req.body || {});
    const owned = req.user?.permissions || [];
    if (!matchPermission(owned, 'epc.delete')) return res.error('Insufficient permissions', 403);
    if (!matchPermission(owned, 'epc.cleanup.delete_all_generated')) return res.error('Insufficient permissions', 403);
    const result = await epcService.deleteAllGeneratedBatches({ organizationId: req.organization.id, corpPrefix: data.corpPrefix });
    res.success(result, 'All generated EPC batches deleted');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

module.exports = {
  getCorpCodes,
  getNextCertificateId,
  peekCertificateId,
  generateBatch,
  listBatches,
  getEpcStats,
  listItems,
  getItemByEpc,
  resetItemsProduction,
  updateItemProduction,
  exportItems,
  deleteItems,
  listBatchItems,
  exportBatch,
  exportBatchVerifyUrls,
  exportBatchProductionTemplate,
  exportBatchImportTemplate,
  importProductionXlsx,
  previewBatchImport,
  previewBatchImportNew,
  submitBatchImport,
  submitBatchImportNew,
  markProductionDone,
  updateBatch,
  deleteBatch,
  importExisting,
  recalculateSequence,
  deleteAll,
  deleteAllGenerated
};
