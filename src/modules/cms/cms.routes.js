const express = require('express');
const router = express.Router();
const cmsController = require('./cms.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(attachOrganization);

// ===== CmsDesign (top-level Landing Design bundles) =====
router.get('/designs', verifyToken, attachAccessContext, requirePermission('cms.read'), requireOrganization, cmsController.listDesigns);
router.post(
  '/design',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('CREATE_CMS_DESIGN', { targetType: 'cms_design' }),
  cmsController.createDesign
);
router.patch(
  '/design/:id',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('UPDATE_CMS_DESIGN', { targetType: 'cms_design', getTargetId: (req) => String(req.params?.id || '') }),
  cmsController.patchDesign
);
router.delete(
  '/design/:id',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('DELETE_CMS_DESIGN', { targetType: 'cms_design', getTargetId: (req) => String(req.params?.id || '') }),
  cmsController.removeDesign
);

// ===== CmsPage (inner pages/seksyen dalam satu design bundle) =====
router.post(
  '/page',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('CREATE_CMS_PAGE', { targetType: 'cms_page' }),
  cmsController.createPage
);
// ?kind=landing&designId=<NUMBER> | designId=null (legacy default) | designId query absent = all designs
router.get('/pages', verifyToken, attachAccessContext, requirePermission('cms.read'), requireOrganization, cmsController.listPages);
router.patch(
  '/pages/order',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('REORDER_CMS_PAGES', { targetType: 'cms_page' }),
  cmsController.reorderPages
);
router.delete(
  '/page/:id',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('DELETE_CMS_PAGE', { targetType: 'cms_page', getTargetId: (req) => String(req.params?.id || '') }),
  cmsController.removePage
);
router.post(
  '/layout',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('UPDATE_CMS', { targetType: 'cms_page', getTargetId: (req) => String(req.body?.pageId || '') }),
  cmsController.saveLayout
);
router.post(
  '/publish',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.publish'),
  requireOrganization,
  auditAction('PUBLISH_CMS', { targetType: 'cms_page', getTargetId: (req) => String(req.body?.pageId || '') }),
  cmsController.publish
);
router.post(
  '/fill-empty',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.write'),
  requireOrganization,
  auditAction('FILL_EMPTY_CMS_TRANSLATION', { targetType: 'cms_page', getTargetId: (req) => String(req.body?.pageId || '') }),
  cmsController.fillEmptyTranslation
);
router.patch(
  '/page/:id/meta',
  verifyToken,
  attachAccessContext,
  requirePermission('cms.meta.write'),
  requireOrganization,
  auditAction('UPDATE_CMS_META', { targetType: 'cms_page', getTargetId: (req) => String(req.params?.id || '') }),
  cmsController.updateMeta
);
router.get('/page/:slug', requireOrganization, cmsController.getPage);

module.exports = router;
