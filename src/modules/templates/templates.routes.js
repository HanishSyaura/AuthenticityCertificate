const express = require('express');
const router = express.Router();
const templatesController = require('./templates.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'templates.read', write: 'templates.write' }));

router.get('/', templatesController.list);
router.get('/:id', templatesController.getOne);
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
