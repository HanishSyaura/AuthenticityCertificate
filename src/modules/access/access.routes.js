const express = require('express');
const router = express.Router();

const accessController = require('./access.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');

router.use(verifyToken);
router.use(attachAccessContext);

router.get('/permissions', requirePermission('access.manage'), accessController.listPermissions);
router.get('/roles', requirePermission('access.manage'), accessController.listRoles);
router.post('/roles', requirePermission('access.manage'), accessController.createRole);
router.patch('/roles/:id', requirePermission('access.manage'), accessController.updateRole);
router.put('/roles/:id/permissions', requirePermission('access.manage'), accessController.setRolePermissions);
router.delete('/roles/:id', requirePermission('access.manage'), accessController.deleteRole);

router.put('/users/:id/roles', requirePermission('users.manage'), accessController.setUserRoles);

module.exports = router;

