const { z } = require('zod');
const apiKeyService = require('../../services/apiKey.service');
const webhookService = require('../../services/webhook.service');

const apiKeyCreateSchema = z.object({
  name: z.string().min(1),
  rateLimitPerMin: z.number().int().min(1).max(10000).optional()
});

const webhookCreateSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8),
  events: z.array(z.enum(['certificate_scanned', 'suspicious_detected', 'fraud_flag_created'])).min(1)
});

const webhookActiveSchema = z.object({
  isActive: z.boolean()
});

async function listApiKeys(req, res) {
  const keys = await apiKeyService.listApiKeys({ organizationId: req.organization.id });
  const safe = keys.map((k) => ({
    id: k.id,
    name: k.name,
    key: k.key,
    rateLimitPerMin: k.rateLimitPerMin,
    createdAt: k.createdAt,
    revokedAt: k.revokedAt
  }));
  res.success(safe);
}

async function createApiKey(req, res) {
  try {
    const data = apiKeyCreateSchema.parse(req.body);
    const created = await apiKeyService.createApiKey({
      organizationId: req.organization.id,
      name: data.name,
      rateLimitPerMin: data.rateLimitPerMin
    });
    res.success(
      {
        id: created.id,
        name: created.name,
        key: created.key,
        rateLimitPerMin: created.rateLimitPerMin,
        createdAt: created.createdAt
      },
      'API key created'
    );
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function revokeApiKey(req, res) {
  try {
    const updated = await apiKeyService.revokeApiKey({ organizationId: req.organization.id, id: req.params.id });
    res.success({ id: updated.id, revokedAt: updated.revokedAt }, 'API key revoked');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function listWebhooks(req, res) {
  const hooks = await webhookService.listWebhooks({ organizationId: req.organization.id });
  const safe = hooks.map((h) => ({
    id: h.id,
    url: h.url,
    events: h.eventsJson,
    isActive: h.isActive,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt
  }));
  res.success(safe);
}

async function createWebhook(req, res) {
  try {
    const data = webhookCreateSchema.parse(req.body);
    const created = await webhookService.createWebhook({
      organizationId: req.organization.id,
      url: data.url,
      secret: data.secret,
      events: data.events
    });
    res.success(
      {
        id: created.id,
        url: created.url,
        events: created.eventsJson,
        isActive: created.isActive
      },
      'Webhook created'
    );
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function setWebhookActive(req, res) {
  try {
    const data = webhookActiveSchema.parse(req.body);
    const updated = await webhookService.setWebhookActive({
      organizationId: req.organization.id,
      id: req.params.id,
      isActive: data.isActive
    });
    res.success({ id: updated.id, isActive: updated.isActive }, 'Webhook updated');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

module.exports = {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listWebhooks,
  createWebhook,
  setWebhookActive
};

