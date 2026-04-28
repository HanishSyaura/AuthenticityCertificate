const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const audit = require('../../services/audit.service');

router.use(verifyToken);
router.use(requireRole(['super_admin', 'admin']));

router.get('/', (req, res) => {
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 200)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  res.success(audit.listAudits({ limit, offset }));
});

module.exports = router;

