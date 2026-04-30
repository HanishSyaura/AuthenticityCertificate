const express = require('express');
const router = express.Router();

const fraudController = require('./fraud.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'fraud.read', write: 'fraud.write' }));

router.get('/flags', fraudController.list);
router.post('/flags', auditAction('CREATE_FRAUD_FLAG', { targetType: 'fraud_flag' }), fraudController.create);
router.patch('/flags/:id/resolve', auditAction('RESOLVE_FRAUD_FLAG', { targetType: 'fraud_flag', getTargetId: (req) => String(req.params.id) }), fraudController.resolve);

module.exports = router;
