const express = require('express');
const router = express.Router();
const categoriesController = require('./categories.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireRole(['super_admin', 'admin']));
router.use(requireOrganization);

router.get('/', categoriesController.getAllCategories);
router.post('/', auditAction('CREATE_CATEGORY', { targetType: 'category' }), categoriesController.createCategory);
router.patch(
  '/:id',
  auditAction('UPDATE_CATEGORY', { targetType: 'category', getTargetId: (req) => req.params.id }),
  categoriesController.updateCategory
);

module.exports = router;
