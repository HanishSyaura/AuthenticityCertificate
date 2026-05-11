const express = require('express');
const router = express.Router();
const epcController = require('./epc.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);

router.get(
  '/corp-codes',
  requirePermission(['epc.read', 'epc.write', 'epc.batch.view', 'epc.batch.create', 'epc.scan.access', 'epc.production.access']),
  epcController.getCorpCodes
);

router.get('/certificate-id/next', requirePermission(['epc.write', 'epc.batch.create']), epcController.getNextCertificateId);
router.get('/certificate-id/peek', requirePermission(['epc.write', 'epc.batch.create']), epcController.peekCertificateId);

router.post(
  '/batches/generate',
  requirePermission(['epc.write', 'epc.batch.create']),
  auditAction('GENERATE_EPC_BATCH', { targetType: 'epc_batch' }),
  epcController.generateBatch
);

router.post(
  '/import-existing-xlsx',
  requirePermission(['epc.write', 'epc.batch.create']),
  auditAction('IMPORT_EXISTING_EPC_XLSX', { targetType: 'epc_batch' }),
  epcController.importExisting
);

router.get(
  '/batches',
  requirePermission(['epc.read', 'epc.write', 'epc.batch.view', 'epc.batch.create', 'epc.scan.access', 'epc.production.access']),
  epcController.listBatches
);

router.patch(
  '/batches/:id',
  requirePermission(['epc.write', 'epc.batch.create']),
  auditAction('UPDATE_EPC_BATCH', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.updateBatch
);

router.delete(
  '/batches/:id',
  requirePermission(['epc.write', 'epc.delete']),
  auditAction('DELETE_EPC_BATCH', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.deleteBatch
);

router.post(
  '/batches/delete-all',
  requirePermission(['epc.write', 'epc.delete']),
  auditAction('DELETE_EPC_BATCH_ALL', { targetType: 'epc_batch' }),
  epcController.deleteAll
);

router.get(
  '/items',
  requirePermission(['epc.read', 'epc.write', 'epc.batch.view', 'epc.batch.create', 'epc.scan.access', 'epc.production.access']),
  epcController.listItems
);

router.get(
  '/items/by-epc',
  requirePermission(['epc.read', 'epc.write', 'epc.batch.view', 'epc.batch.create', 'epc.scan.access', 'epc.production.access']),
  epcController.getItemByEpc
);

router.post(
  '/items/export-xlsx',
  requirePermission(['epc.write', 'epc.export.xlsx', 'epc.production.access']),
  auditAction('EXPORT_EPC_ITEMS_XLSX', { targetType: 'epc_item' }),
  epcController.exportItems
);

router.post(
  '/items/delete',
  requirePermission(['epc.write', 'epc.delete']),
  auditAction('DELETE_EPC_ITEMS', { targetType: 'epc_item' }),
  epcController.deleteItems
);

router.post(
  '/items/production/reset',
  requirePermission(['epc.write', 'epc.scan.access']),
  auditAction('RESET_EPC_ITEM_PRODUCTION', { targetType: 'epc_item' }),
  epcController.resetItemsProduction
);

router.patch(
  '/items/:id/production',
  requirePermission(['epc.write', 'epc.scan.access']),
  auditAction('UPDATE_EPC_ITEM_PRODUCTION', { targetType: 'epc_item', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.updateItemProduction
);

router.get(
  '/batches/:id/items',
  requirePermission(['epc.read', 'epc.write', 'epc.batch.view', 'epc.batch.create', 'epc.scan.access', 'epc.production.access']),
  epcController.listBatchItems
);

router.get('/batches/:id/export-xlsx', requirePermission(['epc.write', 'epc.export.xlsx', 'epc.production.access']), epcController.exportBatch);
router.get('/batches/:id/export-verify-url-xlsx', requirePermission(['epc.write', 'epc.encoding']), epcController.exportBatchVerifyUrls);
router.get('/batches/:id/export-production-template-xlsx', requirePermission(['epc.write', 'epc.batch.create']), epcController.exportBatchProductionTemplate);

router.get(
  '/batch-import/template-xlsx',
  requirePermission(['epc.write', 'epc.production.access']),
  epcController.exportBatchImportTemplate
);

router.post(
  '/batch-import/preview-xlsx',
  requirePermission(['epc.write', 'epc.production.access']),
  auditAction('PREVIEW_EPC_BATCH_IMPORT_XLSX', { targetType: 'epc_batch' }),
  epcController.previewBatchImportNew
);

router.post(
  '/batch-import/submit',
  requirePermission(['epc.write', 'epc.production.access']),
  auditAction('SUBMIT_EPC_BATCH_IMPORT', { targetType: 'epc_batch' }),
  epcController.submitBatchImportNew
);

router.post(
  '/batches/:id/batch-import/preview-xlsx',
  requirePermission(['epc.write', 'epc.production.access']),
  auditAction('PREVIEW_EPC_BATCH_IMPORT_XLSX', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.previewBatchImport
);

router.post(
  '/batches/:id/batch-import/submit',
  requirePermission(['epc.write', 'epc.production.access']),
  auditAction('SUBMIT_EPC_BATCH_IMPORT', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.submitBatchImport
);

router.post(
  '/corp-sequence/recalculate',
  requirePermission(['epc.write', 'epc.sequence.reset']),
  auditAction('RECALC_EPC_SEQUENCE', { targetType: 'corp_sequence' }),
  epcController.recalculateSequence
);

router.post(
  '/batches/:id/production/import-xlsx',
  requirePermission(['epc.write', 'epc.production.access']),
  auditAction('IMPORT_PRODUCTION_XLSX', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.importProductionXlsx
);

router.post(
  '/batches/:id/production/done',
  requirePermission(['epc.write', 'epc.production.access']),
  auditAction('MARK_PRODUCTION_DONE', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.markProductionDone
);

module.exports = router;
