const express = require('express');
const router = express.Router();
const epcController = require('./epc.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'epc.read', write: 'epc.write' }));

router.get('/corp-codes', epcController.getCorpCodes);
router.post('/batches/generate', auditAction('GENERATE_EPC_BATCH', { targetType: 'epc_batch' }), epcController.generateBatch);
router.post('/import-existing-xlsx', auditAction('IMPORT_EXISTING_EPC_XLSX', { targetType: 'epc_batch' }), epcController.importExisting);
router.get('/batches', epcController.listBatches);
router.patch(
  '/batches/:id',
  auditAction('UPDATE_EPC_BATCH', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }),
  epcController.updateBatch
);
router.delete('/batches/:id', auditAction('DELETE_EPC_BATCH', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }), epcController.deleteBatch);
router.post('/batches/delete-all', auditAction('DELETE_EPC_BATCH_ALL', { targetType: 'epc_batch' }), epcController.deleteAll);
router.get('/items', epcController.listItems);
router.get('/batches/:id/items', epcController.listBatchItems);
router.get('/batches/:id/export-xlsx', epcController.exportBatch);
router.post('/corp-sequence/recalculate', auditAction('RECALC_EPC_SEQUENCE', { targetType: 'corp_sequence' }), epcController.recalculateSequence);
router.post('/batches/:id/production/import-xlsx', auditAction('IMPORT_PRODUCTION_XLSX', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }), epcController.importProductionXlsx);
router.post('/batches/:id/production/done', auditAction('MARK_PRODUCTION_DONE', { targetType: 'epc_batch', getTargetId: (req) => String(req.params?.id || '') }), epcController.markProductionDone);

module.exports = router;
