const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization } = require('../../middleware/org.middleware');
const orgController = require('./organizations.controller');

router.use(verifyToken);
router.use(attachOrganization);

router.get('/me', orgController.me);
router.get('/', requireRole(['super_admin', 'admin']), orgController.list);
router.post('/', requireRole(['super_admin']), auditAction('CREATE_ORG', { targetType: 'organization' }), orgController.create);

module.exports = router;

