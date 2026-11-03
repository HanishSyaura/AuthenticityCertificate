const express = require('express');
const router = express.Router();
const controller = require('./suppliers.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'products.read', write: 'products.write' }));

router.get('/', controller.getAllSuppliers);
router.post(
  '/',
  auditAction('CREATE_SUPPLIER', { targetType: 'supplier' }),
  controller.createSupplier
);
router.patch(
  '/:id',
  auditAction('UPDATE_SUPPLIER', {
    targetType: 'supplier',
    getTargetId: (req) => req.params.id
  }),
  controller.updateSupplier
);

module.exports = router;
