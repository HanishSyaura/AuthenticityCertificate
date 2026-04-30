const crypto = require('crypto');
const prisma = require('../config/prisma');
const counters = new Map();

function makeKey() {
  return `ak_${crypto.randomBytes(24).toString('hex')}`;
}

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function checkRateLimit(apiKey) {
  const limit = Math.max(1, Number(apiKey.rateLimitPerMin || 120));
  const now = Date.now();
  const windowMs = 60_000;
  const key = apiKey.key;
  const entry = counters.get(key);
  if (!entry || entry.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

async function createApiKey({ organizationId, name, rateLimitPerMin }) {
  const orgId = Number(organizationId);
  const key = makeKey();
  const data = {
    organizationId: orgId,
    name,
    key,
    rateLimitPerMin: rateLimitPerMin ? Number(rateLimitPerMin) : 120
  };
  const created = await withTimeout(prisma.apiKey.create({ data }), 1200);
  return created;
}

async function listApiKeys({ organizationId }) {
  const orgId = Number(organizationId);
  return await withTimeout(
    prisma.apiKey.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } }),
    1200
  );
}

async function revokeApiKey({ organizationId, id }) {
  void organizationId;
  return await withTimeout(prisma.apiKey.update({ where: { id: Number(id) }, data: { revokedAt: new Date() } }), 1200);
}

async function findApiKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  const found = await withTimeout(prisma.apiKey.findFirst({ where: { key } }), 800);
  if (!found) return null;
  if (found.revokedAt) return null;
  return found;
}

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  findApiKey,
  checkRateLimit
};
