const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext } = require('../../middleware/access.middleware');

router.post('/login', authController.login);

router.get('/me', verifyToken, attachAccessContext, authController.me);
router.patch('/me', verifyToken, attachAccessContext, authController.updateMe);

module.exports = router;
