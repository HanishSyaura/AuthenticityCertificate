const express = require('express');
const router = express.Router();
const epcController = require('./epc.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireRole(['super_admin', 'admin']));
router.use(requireOrganization);

router.get('/corp-codes', epcController.getCorpCodes);
router.post('/batches/generate', auditAction('GENERATE_EPC_BATCH', { targetType: 'epc_batch' }), epcController.generateBatch);
router.get('/batches', epcController.listBatches);
router.get('/items', epcController.listItems);
router.get('/batches/:id/items', epcController.listBatchItems);
router.get('/batches/:id/export-xlsx', epcController.exportBatch);

module.exports = router;
