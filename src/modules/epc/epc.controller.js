const { z } = require('zod');
const epcService = require('./epc.service');
const { matchPermission } = require('../../middleware/access.middleware');
const prisma = require('../../config/prisma');

const EPC_BATCH_IMPORT_AUDIT_ACTION = 'SUBMIT_EPC_BATCH_IMPORT';

function resolveStatus(error, fallback = 400) {
  const msg = String(error?.message || '');
  const code = error?.code;
  const lower = msg.toLowerCase();
  const status = Number(error?.status);
  if (Number.isFinite(status) && status >= 400 && status <= 599) return status;
  if (msg === 'db_timeout') return 503;
  if (code === 'P2021') return 503;
  if (code === 'P1001' || code === 'P1002' || code === 'P1003') return 503;
  if (lower.includes('database') && (lower.includes('timeout') || lower.includes('unavailable') || lower.includes('connect'))) return 503;
  return fallback;
}

function resolveMessage(error) {
  const msg = String(error?.message || 'Unknown error');
  const code = error?.code;
  if (msg === 'db_timeout') return 'Database tidak dapat diakses (timeout). Sila cuba lagi.';
  if (code === 'P2021') return 'Database schema belum siap (table tiada). Sila jalankan patch/migrasi DB.';
  return msg;
}

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
  base64: z.string().min(1),
  productId: z.union([z.number().int().positive(), z.null()]).optional(),
  certificateTemplateId: z.union([z.number().int().positive(), z.null()]).optional(),
  documents: z.record(z.string(), z.string()).optional()
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

const updateBatchDocumentsSchema = z.object({
  documents: z
    .record(z.string(), z.string())
    .refine((v) => v && typeof v === 'object' && Object.keys(v).length > 0, 'documents required')
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

const createScanGroupSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1).max(2000)
});

const assignScanGroupProductSchema = z.object({
  productId: z.number().int().positive()
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
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const status = statusRaw ? statusRaw.toUpperCase() : '';
    if (status && status !== 'ACTIVE' && status !== 'INACTIVE') return res.error('Invalid status', 400);
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
      status: status || null,
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

async function createScanGroup(req, res) {
  try {
    const data = createScanGroupSchema.parse(req.body || {});
    const result = await epcService.createScanGroup({
      organizationId: req.organization.id,
      itemIds: data.itemIds,
      actor: req.user
    });
    res.success(result, 'Scan group created');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
    const status = Number(e.status) || 400;
    res.error(e.message, status);
  }
}

async function listScanGroups(req, res) {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const data = await epcService.listScanGroups({
      organizationId: req.organization.id,
      status: status || null,
      limit,
      offset
    });
    res.success(data);
  } catch (e) {
    const status = Number(e.status) || 400;
    res.error(e.message, status);
  }
}

async function getScanGroup(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.error('Invalid scan group id', 400);
    const data = await epcService.getScanGroupSummary({ organizationId: req.organization.id, scanGroupId: id });
    res.success(data);
  } catch (e) {
    const status = Number(e.status) || 400;
    res.error(e.message, status);
  }
}

async function assignScanGroupProduct(req, res) {
  try {
    const owned = req.user?.permissions || [];
    const role = String(req.user?.role || '').trim();
    const canProduction = role === 'super_admin' || role === 'admin' || matchPermission(owned, 'epc.production.access') || matchPermission(owned, '*');
    if (!canProduction) return res.error('Insufficient permissions', 403);

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.error('Invalid scan group id', 400);
    const body = assignScanGroupProductSchema.parse(req.body || {});
    const data = await epcService.assignScanGroupProduct({
      organizationId: req.organization.id,
      scanGroupId: id,
      productId: body.productId,
      actor: req.user
    });
    res.success(data, 'Product assigned');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
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
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
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
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
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
    res.error(e.message, e?.status || 400);
  }
}

async function previewBatchImport(req, res) {
  try {
    const batchId = Number(req.params.id);
    const data = previewBatchImportSchema.parse(req.body);
    const result = await epcService.previewBatchImportXlsx({ organizationId: req.organization.id, batchId, base64: data.base64 });
    res.success(result);
  } catch (e) {
    res.error(e.message, e?.status || 400);
  }
}

async function previewBatchImportNew(req, res) {
  try {
    const data = previewBatchImportSchema.parse(req.body);
    const result = await epcService.previewBatchImportXlsx({ organizationId: req.organization.id, batchId: null, base64: data.base64 });
    res.success(result);
  } catch (e) {
    res.error(e.message, e?.status || 400);
  }
}

async function submitBatchImport(req, res) {
  try {
    const batchId = Number(req.params.id);
    const data = submitBatchImportSchema.parse(req.body);
    const result = await epcService.submitBatchImport({
      organizationId: req.organization.id,
      batchId,
      base64: data.base64,
      productId: Object.prototype.hasOwnProperty.call(data, 'productId') ? data.productId : undefined,
      sku: null,
      certificateTemplateId: Object.prototype.hasOwnProperty.call(data, 'certificateTemplateId') ? data.certificateTemplateId : undefined,
      documents: Object.prototype.hasOwnProperty.call(data, 'documents') ? data.documents : {}
    });
    res.locals.auditMetadata = {
      type: 'batch_import',
      rows: result?.rows ?? null,
      updated: result?.updated ?? null,
      productId: Object.prototype.hasOwnProperty.call(data, 'productId') ? data.productId : null,
      certificateTemplateId: Object.prototype.hasOwnProperty.call(data, 'certificateTemplateId') ? data.certificateTemplateId : null,
      batchIds: Number.isFinite(batchId) && batchId > 0 ? [batchId] : [],
      items: []
    };
    res.success(result, 'Batch import saved');
  } catch (e) {
    if (e instanceof z.ZodError) {
      const first = Array.isArray(e.issues) ? e.issues[0] : null;
      const field = first?.path?.length ? first.path.join('.') : 'form';
      const detail = first?.message ? `: ${first.message}` : '';
      return res.error(`Invalid input (${field})${detail}`, 400);
    }
    res.error(resolveMessage(e), resolveStatus(e, 400));
  }
}

async function submitBatchImportNew(req, res) {
  try {
    const data = submitBatchImportSchema.parse(req.body);
    const result = await epcService.createImportBatchFromXlsx({
      organizationId: req.organization.id,
      base64: data.base64,
      productId: Object.prototype.hasOwnProperty.call(data, 'productId') ? data.productId : undefined,
      sku: null,
      certificateTemplateId: Object.prototype.hasOwnProperty.call(data, 'certificateTemplateId') ? data.certificateTemplateId : undefined,
      documents: Object.prototype.hasOwnProperty.call(data, 'documents') ? data.documents : {},
      actor: req.user
    });
    res.locals.auditMetadata = {
      type: 'batch_import',
      rows: result?.rows ?? null,
      uniqueEpcs: result?.uniqueEpcs ?? null,
      updated: result?.updated ?? null,
      productId: result?.productId ?? null,
      certificateTemplateId: Object.prototype.hasOwnProperty.call(data, 'certificateTemplateId') ? data.certificateTemplateId : null,
      batchIds: Array.isArray(result?.batchIds) ? result.batchIds : [],
      items: Array.isArray(result?.items) ? result.items : []
    };
    res.success(result, 'Batch import saved');
  } catch (e) {
    if (e instanceof z.ZodError) {
      const first = Array.isArray(e.issues) ? e.issues[0] : null;
      const field = first?.path?.length ? first.path.join('.') : 'form';
      const detail = first?.message ? `: ${first.message}` : '';
      return res.error(`Invalid input (${field})${detail}`, 400);
    }
    res.error(resolveMessage(e), resolveStatus(e, 400));
  }
}

async function listBatchImportHistory(req, res) {
  try {
    const { limit, offset } = parseLimitOffset(req.query);
    const orgId = req.organization.id;
    const epcCount = await prisma.epcItem.count({ where: { organizationId: orgId } });
    if (!Number(epcCount)) {
      await prisma.auditLog.deleteMany({ where: { organizationId: orgId, action: EPC_BATCH_IMPORT_AUDIT_ACTION } });
      return res.success({ total: 0, items: [] });
    }

    const where = { organizationId: orgId, action: EPC_BATCH_IMPORT_AUDIT_ACTION };
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: { id: true, actorEmail: true, userId: true, createdAt: true, metadata: true }
      })
    ]);

    const productIds = [];
    const certificateTemplateIds = [];
    for (const r of Array.isArray(rows) ? rows : []) {
      const meta = r?.metadata && typeof r.metadata === 'object' ? r.metadata : {};
      const productIdNum = Number(meta?.productId);
      if (Number.isFinite(productIdNum) && productIdNum > 0) productIds.push(productIdNum);
      const templateIdNum = Number(meta?.certificateTemplateId);
      if (Number.isFinite(templateIdNum) && templateIdNum > 0) certificateTemplateIds.push(templateIdNum);
    }

    const uniqueProductIds = Array.from(new Set(productIds));
    const uniqueTemplateIds = Array.from(new Set(certificateTemplateIds));

    const [products, templates] = await Promise.all([
      uniqueProductIds.length
        ? prisma.product.findMany({ where: { organizationId: orgId, id: { in: uniqueProductIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      uniqueTemplateIds.length
        ? prisma.certificateTemplate.findMany({
            where: { organizationId: orgId, id: { in: uniqueTemplateIds } },
            select: { id: true, name: true }
          })
        : Promise.resolve([])
    ]);

    const productMap = new Map((Array.isArray(products) ? products : []).map((p) => [p.id, p]));
    const templateMap = new Map((Array.isArray(templates) ? templates : []).map((t) => [t.id, t]));

    const items = (Array.isArray(rows) ? rows : []).map((r) => {
      const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
      const batchIds = Array.isArray(meta?.batchIds) ? meta.batchIds : [];
      const productId = meta?.productId ?? null;
      const productIdNum = Number(productId);
      const certificateTemplateId = meta?.certificateTemplateId ?? null;
      const certificateTemplateIdNum = Number(certificateTemplateId);
      return {
        id: r.id,
        actorEmail: r.actorEmail,
        userId: r.userId,
        createdAt: r.createdAt,
        summary: {
          productId,
          productName: Number.isFinite(productIdNum) ? productMap.get(productIdNum)?.name ?? null : null,
          certificateTemplateId,
          certificateTemplateName: Number.isFinite(certificateTemplateIdNum) ? templateMap.get(certificateTemplateIdNum)?.name ?? null : null,
          rows: meta?.rows ?? null,
          uniqueEpcs: meta?.uniqueEpcs ?? null,
          updated: meta?.updated ?? null,
          batchIds
        }
      };
    });

    res.success({ total, items });
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function getBatchImportHistory(req, res) {
  try {
    const orgId = req.organization.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.error('Invalid id', 400);
    const epcCount = await prisma.epcItem.count({ where: { organizationId: orgId } });
    if (!Number(epcCount)) {
      await prisma.auditLog.deleteMany({ where: { organizationId: orgId, action: EPC_BATCH_IMPORT_AUDIT_ACTION } });
      return res.error('Not found', 404);
    }
    const row = await prisma.auditLog.findFirst({
      where: { id, organizationId: orgId, action: EPC_BATCH_IMPORT_AUDIT_ACTION },
      select: { id: true, actorEmail: true, userId: true, createdAt: true, metadata: true }
    });
    if (!row) return res.error('Not found', 404);
    res.success(row);
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
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
    res.error(e.message, 400);
  }
}

async function updateBatchDocuments(req, res) {
  try {
    const batchId = Number(req.params.id);
    const data = updateBatchDocumentsSchema.parse(req.body || {});
    const updated = await epcService.updateBatchDocuments({ organizationId: req.organization.id, batchId, documents: data.documents });
    res.success(updated, 'Batch documents updated');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
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
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
    res.error(e.message, 400);
  }
}

async function deleteAll(req, res) {
  try {
    const data = deleteAllSchema.parse(req.body || {});
    const result = await epcService.deleteAllBatches({ organizationId: req.organization.id, corpPrefix: data.corpPrefix });
    res.success(result, 'All EPC batches deleted');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
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
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
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
  createScanGroup,
  listScanGroups,
  getScanGroup,
  assignScanGroupProduct,
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
  listBatchImportHistory,
  getBatchImportHistory,
  markProductionDone,
  updateBatch,
  updateBatchDocuments,
  deleteBatch,
  importExisting,
  recalculateSequence,
  deleteAll,
  deleteAllGenerated
};
