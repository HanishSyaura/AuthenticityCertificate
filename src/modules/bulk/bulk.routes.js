const express = require('express');
const router = express.Router();

const bulkController = require('./bulk.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireRole(['super_admin', 'admin', 'operator']));

router.post('/certificates/generate', auditAction('BULK_GENERATE_CERTS', { targetType: 'batch' }), bulkController.generate);
router.post('/certificates/revoke', auditAction('BULK_REVOKE_CERTS', { targetType: 'certificate' }), bulkController.revoke);
router.post('/identities/assign', auditAction('BULK_ASSIGN_IDENTITIES', { targetType: 'certificate' }), bulkController.assign);
router.post('/identities/assign-xlsx', auditAction('BULK_ASSIGN_IDENTITIES_XLSX', { targetType: 'certificate' }), bulkController.assignXlsx);
router.post('/import-xlsx', auditAction('BULK_IMPORT_XLSX', { targetType: 'organization' }), bulkController.importXlsx);

router.get('/jobs/:id', bulkController.jobStatus);

module.exports = router;
