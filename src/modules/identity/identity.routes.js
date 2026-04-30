const express = require('express');
const router = express.Router();

const identityController = require('./identity.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'identities.read', write: 'identities.write' }));

router.get('/', identityController.list);
router.post(
  '/:id/unassign',
  auditAction('UNASSIGN_IDENTITY', { targetType: 'tag_identity', getTargetId: (req) => req.params.id }),
  identityController.unassign
);

module.exports = router;
