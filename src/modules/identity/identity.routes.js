const express = require('express');
const router = express.Router();

const identityController = require('./identity.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireRole(['super_admin', 'admin']));
router.use(requireOrganization);

router.get('/', identityController.list);
router.post(
  '/:id/unassign',
  auditAction('UNASSIGN_IDENTITY', { targetType: 'tag_identity', getTargetId: (req) => req.params.id }),
  identityController.unassign
);

module.exports = router;

