const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireRole(['super_admin', 'admin']));
router.use(requireOrganization);

router.get('/overview', analyticsController.overview);
router.get('/scans', analyticsController.scans);
router.get('/cert/:id', analyticsController.certificateTimeline);
router.post('/cert/:id/status', express.json(), auditAction('SET_CERT_STATUS', { targetType: 'certificate', getTargetId: (req) => req.params.id }), analyticsController.setStatus);

module.exports = router;
