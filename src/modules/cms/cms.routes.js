const express = require('express');
const router = express.Router();
const cmsController = require('./cms.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(attachOrganization);

router.post(
  '/page',
  verifyToken,
  requireRole(['super_admin', 'admin', 'operator']),
  requireOrganization,
  auditAction('CREATE_CMS_PAGE', { targetType: 'cms_page' }),
  cmsController.createPage
);
router.get('/pages', verifyToken, requireRole(['super_admin', 'admin', 'operator']), requireOrganization, cmsController.listPages);
router.post(
  '/layout',
  verifyToken,
  requireRole(['super_admin', 'admin', 'operator']),
  requireOrganization,
  auditAction('UPDATE_CMS', { targetType: 'cms_page', getTargetId: (req) => String(req.body?.pageId || '') }),
  cmsController.saveLayout
);
router.post(
  '/publish',
  verifyToken,
  requireRole(['super_admin', 'admin']),
  requireOrganization,
  auditAction('PUBLISH_CMS', { targetType: 'cms_page', getTargetId: (req) => String(req.body?.pageId || '') }),
  cmsController.publish
);
router.patch(
  '/page/:id/meta',
  verifyToken,
  requireRole(['super_admin', 'admin']),
  requireOrganization,
  auditAction('UPDATE_CMS_META', { targetType: 'cms_page', getTargetId: (req) => String(req.params?.id || '') }),
  cmsController.updateMeta
);
router.get('/page/:slug', requireOrganization, cmsController.getPage);

module.exports = router;
