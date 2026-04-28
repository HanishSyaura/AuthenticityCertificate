const express = require('express');
const router = express.Router();

const usersController = require('./users.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(requireRole(['super_admin']));

router.get('/', usersController.list);
router.post('/', auditAction('CREATE_USER', { targetType: 'user' }), usersController.create);
router.patch('/:id/role', auditAction('UPDATE_USER_ROLE', { targetType: 'user', getTargetId: (req) => req.params.id }), usersController.updateRole);
router.delete('/:id', auditAction('DELETE_USER', { targetType: 'user', getTargetId: (req) => req.params.id }), usersController.remove);

module.exports = router;

