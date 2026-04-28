const express = require('express');
const router = express.Router();

const publicRoutes = require('./public.routes');
const { requireApiKey } = require('../../middleware/apiKey.middleware');

router.use(requireApiKey);
router.use(publicRoutes);

module.exports = router;

