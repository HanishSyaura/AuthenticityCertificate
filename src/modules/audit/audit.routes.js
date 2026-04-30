const express = require('express');
const router = express.Router();

const { verifyToken } = require('../../middleware/auth.middleware');
const { attachAccessContext, requirePermission } = require('../../middleware/access.middleware');
const audit = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachAccessContext);
router.use(requirePermission('audit.read'));

router.get('/', (req, res) => {
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 200)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  audit
    .listAudits({ limit, offset })
    .then((data) => res.success(data))
    .catch((e) => res.error(e?.message || 'Failed to load audit log'));
});

module.exports = router;
