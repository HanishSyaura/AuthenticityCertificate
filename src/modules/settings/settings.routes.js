const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization } = require('../../middleware/org.middleware');
const settingsController = require('./settings.controller');

router.use(verifyToken);
router.use(attachOrganization);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

module.exports = router;

