const express = require('express');
const router = express.Router();

const accessController = require('./access.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachAccessContext);

router.get('/audit-logs', requirePermission('access.manage'), accessController.listAccessAuditLogs);
router.get('/permissions', requirePermission('access.manage'), accessController.listPermissions);
router.get('/roles', requirePermission('access.manage'), accessController.listRoles);
router.post(
  '/roles',
  requirePermission('access.manage'),
  auditAction('CREATE_ROLE', {
    targetType: 'role',
    getMetadata: (req) => ({ name: req.body?.name })
  }),
  accessController.createRole
);
router.patch(
  '/roles/:id',
  requirePermission('access.manage'),
  auditAction('UPDATE_ROLE', {
    targetType: 'role',
    getTargetId: (req) => req.params.id
  }),
  accessController.updateRole
);
router.put(
  '/roles/:id/permissions',
  requirePermission('access.manage'),
  auditAction('UPDATE_ROLE_PERMISSIONS', {
    targetType: 'role',
    getTargetId: (req) => req.params.id,
    getMetadata: (req) => ({
      permissionKeys: Array.isArray(req.body?.permissionKeys)
        ? [...new Set(req.body.permissionKeys.map((key) => String(key).trim()).filter(Boolean))]
        : []
    })
  }),
  accessController.setRolePermissions
);
router.delete(
  '/roles/:id',
  requirePermission('access.manage'),
  auditAction('DELETE_ROLE', {
    targetType: 'role',
    getTargetId: (req) => req.params.id
  }),
  accessController.deleteRole
);

router.put(
  '/users/:id/roles',
  requirePermission('access.manage'),
  auditAction('ASSIGN_USER_ROLES', {
    targetType: 'user',
    getTargetId: (req) => req.params.id,
    getMetadata: (req) => ({ roleIds: req.body?.roleIds || [] })
  }),
  accessController.setUserRoles
);

module.exports = router;

