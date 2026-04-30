const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization } = require('../../middleware/org.middleware');
const orgController = require('./organizations.controller');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);

router.get('/me', orgController.me);
router.get('/', requirePermission('organizations.read'), orgController.list);
router.post('/', requirePermission('organizations.write'), auditAction('CREATE_ORG', { targetType: 'organization' }), orgController.create);

module.exports = router;
