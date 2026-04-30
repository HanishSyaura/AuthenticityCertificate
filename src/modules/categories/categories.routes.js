const express = require('express');
const router = express.Router();
const categoriesController = require('./categories.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'categories.read', write: 'categories.write' }));

router.get('/', categoriesController.getAllCategories);
router.post('/', auditAction('CREATE_CATEGORY', { targetType: 'category' }), categoriesController.createCategory);
router.patch(
  '/:id',
  auditAction('UPDATE_CATEGORY', { targetType: 'category', getTargetId: (req) => req.params.id }),
  categoriesController.updateCategory
);

module.exports = router;
