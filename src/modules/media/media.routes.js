const express = require('express');
const router = express.Router();

const mediaController = require('./media.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireRole(['super_admin', 'admin']));

router.get('/', mediaController.list);
router.post('/upload', auditAction('UPLOAD_MEDIA', { targetType: 'media_asset' }), mediaController.uploadFile);
router.delete(
  '/:id',
  auditAction('DELETE_MEDIA', { targetType: 'media_asset', getTargetId: (req) => req.params.id }),
  mediaController.remove
);

module.exports = router;

