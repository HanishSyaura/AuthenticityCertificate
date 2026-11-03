const express = require('express');
const router = express.Router();

const usersController = require('./users.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachAccessContext);

router.get(
  '/',
  requirePermission(['users.read', 'users.manage']),
  usersController.list
);

router.post(
  '/',
  requirePermission(['users.create', 'users.manage']),
  auditAction('CREATE_USER', { targetType: 'user' }),
  usersController.create
);

router.post(
  '/:id/reset-password',
  requirePermission(['users.password.reset', 'users.manage']),
  auditAction('RESET_USER_PASSWORD', {
    targetType: 'user',
    getTargetId: (req) => req.params.id
  }),
  usersController.resetPassword
);

router.patch(
  '/:id/role',
  requirePermission(['users.roles.assign', 'users.manage']),
  auditAction('UPDATE_USER_ROLE', {
    targetType: 'user',
    getTargetId: (req) => req.params.id
  }),
  usersController.updateRole
);

router.delete(
  '/:id',
  requirePermission(['users.delete', 'users.manage']),
  auditAction('DELETE_USER', {
    targetType: 'user',
    getTargetId: (req) => req.params.id
  }),
  usersController.remove
);

module.exports = router;
