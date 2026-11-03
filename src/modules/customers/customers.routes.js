const express = require('express');
const router = express.Router();
const controller = require('./customers.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requireAccess } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireAccess({ read: 'products.read', write: 'products.write' }));

router.get('/', controller.getAllCustomers);
router.post(
  '/',
  auditAction('CREATE_CUSTOMER', { targetType: 'customer' }),
  controller.createCustomer
);
router.patch(
  '/:id',
  auditAction('UPDATE_CUSTOMER', {
    targetType: 'customer',
    getTargetId: (req) => req.params.id
  }),
  controller.updateCustomer
);

module.exports = router;
