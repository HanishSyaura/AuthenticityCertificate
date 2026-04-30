const express = require('express');
const router = express.Router();

const mediaController = require('./media.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'media.read', write: 'media.write' }));

router.get('/', mediaController.list);
router.post('/upload', auditAction('UPLOAD_MEDIA', { targetType: 'media_asset' }), mediaController.uploadFile);
router.delete(
  '/:id',
  auditAction('DELETE_MEDIA', { targetType: 'media_asset', getTargetId: (req) => req.params.id }),
  mediaController.remove
);

module.exports = router;
