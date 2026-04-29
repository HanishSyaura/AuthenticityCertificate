const express = require('express');
const router = express.Router();
const certificateController = require('./certificate.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireRole(['super_admin', 'admin']));
router.use(requireOrganization);

router.get('/', certificateController.list);
router.get('/:id', certificateController.get);

router.post('/generate', auditAction('CREATE_CERT', { targetType: 'certificate' }), certificateController.generate);

router.post(
  '/assign',
  auditAction('ASSIGN_IDENTITY', { targetType: 'certificate', getTargetId: (req) => String(req.body?.certificateId || '') }),
  certificateController.assign
);

router.post(
  '/reissue',
  auditAction('REISSUE_CERT', { targetType: 'certificate', getTargetId: (req) => String(req.body?.certificateId || '') }),
  certificateController.reissue
);
router.post('/revoke/:id', auditAction('REVOKE_CERT', { targetType: 'certificate', getTargetId: (req) => req.params.id }), certificateController.revoke);

module.exports = router;
