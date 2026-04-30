const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

router.post('/login', authController.login);

router.get('/me', verifyToken, authController.me);
router.patch('/me', verifyToken, authController.updateMe);

module.exports = router;
