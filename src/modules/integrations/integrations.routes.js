const express = require('express');
const router = express.Router();

const integrations = require('./integrations.controller');
const { verifyToken } = require('../../middleware/auth.middleware');
const { attachOrganization, requireOrganization } = require('../../middleware/org.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { auditAction } = require('../../services/audit.service');

router.use(verifyToken);
router.use(attachOrganization);
router.use(requireOrganization);
router.use(requireRole(['super_admin', 'admin']));

router.get('/api-keys', integrations.listApiKeys);
router.post('/api-keys', auditAction('CREATE_API_KEY', { targetType: 'api_key' }), integrations.createApiKey);
router.post('/api-keys/:id/revoke', auditAction('REVOKE_API_KEY', { targetType: 'api_key', getTargetId: (req) => String(req.params.id) }), integrations.revokeApiKey);

router.get('/webhooks', integrations.listWebhooks);
router.post('/webhooks', auditAction('CREATE_WEBHOOK', { targetType: 'webhook' }), integrations.createWebhook);
router.patch('/webhooks/:id', auditAction('UPDATE_WEBHOOK', { targetType: 'webhook', getTargetId: (req) => String(req.params.id) }), integrations.setWebhookActive);

module.exports = router;

