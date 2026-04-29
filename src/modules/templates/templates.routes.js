const express = require('express');
const router = express.Router();
const templatesController = require('./templates.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireRole(['super_admin', 'admin']));
router.use(requireOrganization);

router.get('/', templatesController.list);
router.post('/', auditAction('CREATE_TEMPLATE', { targetType: 'certificate_template' }), templatesController.create);
router.patch(
  '/:id',
  auditAction('UPDATE_TEMPLATE', { targetType: 'certificate_template', getTargetId: (req) => req.params.id }),
  templatesController.update
);
router.delete(
  '/:id',
  auditAction('DELETE_TEMPLATE', { targetType: 'certificate_template', getTargetId: (req) => req.params.id }),
  templatesController.remove
);

module.exports = router;

