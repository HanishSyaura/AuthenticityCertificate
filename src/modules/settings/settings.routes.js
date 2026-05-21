const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization } = require('../../middleware/org.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const settingsController = require('./settings.controller');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(attachOrganization);

router.get('', requirePermission('settings.read'), settingsController.getSettings);
router.get('/', requirePermission('settings.read'), settingsController.getSettings);
router.get('/notification-roles', requirePermission('settings.read'), settingsController.listNotificationRoles);
router.put('', requirePermission('settings.write'), settingsController.updateSettings);
router.put('/', requirePermission('settings.write'), settingsController.updateSettings);
router.post('/smtp/test', requirePermission('settings.write'), settingsController.sendSmtpTestEmail);

module.exports = router;
