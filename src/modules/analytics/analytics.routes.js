const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requirePermission('analytics.read'));

router.get('/overview', analyticsController.overview);
router.get('/scans', analyticsController.scans);
router.get('/cert/:id', analyticsController.certificateTimeline);
router.post(
  '/cert/:id/status',
  requirePermission('certificates.write'),
  express.json(),
  auditAction('SET_CERT_STATUS', { targetType: 'certificate', getTargetId: (req) => req.params.id }),
  analyticsController.setStatus
);

module.exports = router;
