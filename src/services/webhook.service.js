const crypto = require('crypto');
const prisma = require('../config/prisma');
const jobQueue = require('./jobQueue.service');

const memHooks = [];

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function sign(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function listWebhooks({ organizationId }) {
  const orgId = Number(organizationId);
  try {
    return await withTimeout(
      prisma.webhookEndpoint.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } }),
      600
    );
  } catch {
    return memHooks.filter((h) => h.organizationId === orgId);
  }
}

async function createWebhook({ organizationId, url, secret, events }) {
  const orgId = Number(organizationId);
  const data = {
    organizationId: orgId,
    url,
    secret,
    eventsJson: events,
    isActive: true
  };
  try {
    return await withTimeout(prisma.webhookEndpoint.create({ data }), 600);
  } catch {
    const next = { id: Date.now(), ...data, createdAt: new Date(), updatedAt: new Date() };
    memHooks.unshift(next);
    return next;
  }
}

async function setWebhookActive({ organizationId, id, isActive }) {
  const orgId = Number(organizationId);
  try {
    return await withTimeout(
      prisma.webhookEndpoint.update({ where: { id: Number(id) }, data: { isActive: !!isActive } }),
      600
    );
  } catch {
    const idx = memHooks.findIndex((h) => String(h.id) === String(id) && h.organizationId === orgId);
    if (idx === -1) throw new Error('Webhook not found');
    memHooks[idx] = { ...memHooks[idx], isActive: !!isActive, updatedAt: new Date() };
    return memHooks[idx];
  }
}

async function deliverOne({ hook, event, data }) {
  const payloadObj = { event, data, ts: new Date().toISOString() };
  const payload = JSON.stringify(payloadObj);
  const signature = sign(hook.secret, payload);

  const res = await fetch(hook.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event
    },
    body: payload
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Webhook failed: ${res.status} ${text}`);
  }
  return { ok: true, status: res.status };
}

async function deliver({ organizationId, event, data }) {
  const orgId = Number(organizationId);
  const hooks = (await listWebhooks({ organizationId: orgId })).filter((h) => h.isActive);

  const targets = hooks.filter((h) => {
    const list = Array.isArray(h.eventsJson) ? h.eventsJson : [];
    return list.includes(event);
  });

  const results = [];
  for (const hook of targets) {
    try {
      const r = await deliverOne({ hook, event, data });
      results.push({ webhookId: hook.id, ...r });
    } catch (e) {
      results.push({ webhookId: hook.id, ok: false, error: e?.message || String(e) });
    }
  }
  return results;
}

jobQueue.registerHandler('deliver_webhook', async ({ organizationId, event, data }) => {
  return await deliver({ organizationId, event, data });
});

async function emitEvent({ organizationId, event, data }) {
  if (jobQueue.hasRedis()) {
    await jobQueue.addJob('deliver_webhook', { organizationId, event, data });
    return;
  }
  setTimeout(() => {
    void deliver({ organizationId, event, data });
  }, 0);
}

module.exports = {
  listWebhooks,
  createWebhook,
  setWebhookActive,
  emitEvent
};
