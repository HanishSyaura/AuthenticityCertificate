const express = require('express');
const router = express.Router();
const certificateController = require('./certificate.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'certificates.read', write: 'certificates.write' }));

router.get('/', certificateController.list);
router.get('/:id', certificateController.get);

router.patch('/:id', auditAction('UPDATE_CERT', { targetType: 'certificate', getTargetId: (req) => req.params.id }), certificateController.patch);

router.post(
  '/bulk/assign-landing-design',
  auditAction('BULK_ASSIGN_CMS_DESIGN', { targetType: 'certificate' }),
  certificateController.bulkAssignLandingDesign
);

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
