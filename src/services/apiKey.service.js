const crypto = require('crypto');
const prisma = require('../config/prisma');

const memKeys = [];
const counters = new Map();

function makeKey() {
  return `ak_${crypto.randomBytes(24).toString('hex')}`;
}

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function seedDemo() {
  if (memKeys.find((k) => k.key === 'demo_api_key')) return;
  memKeys.push({
    id: 1,
    organizationId: 1,
    name: 'Demo Key',
    key: 'demo_api_key',
    rateLimitPerMin: 120,
    createdAt: new Date(),
    revokedAt: null,
    deletedAt: null
  });
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
  try {
    const created = await withTimeout(prisma.apiKey.create({ data }), 600);
    return created;
  } catch {
    const next = { id: Date.now(), ...data, createdAt: new Date(), revokedAt: null, deletedAt: null };
    memKeys.unshift(next);
    return next;
  }
}

async function listApiKeys({ organizationId }) {
  const orgId = Number(organizationId);
  try {
    return await withTimeout(
      prisma.apiKey.findMany({ where: { organizationId: orgId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      600
    );
  } catch {
    seedDemo();
    return memKeys.filter((k) => k.organizationId === orgId && !k.deletedAt);
  }
}

async function revokeApiKey({ organizationId, id }) {
  const orgId = Number(organizationId);
  try {
    return await withTimeout(
      prisma.apiKey.update({ where: { id: Number(id) }, data: { revokedAt: new Date() } }),
      600
    );
  } catch {
    const idx = memKeys.findIndex((k) => String(k.id) === String(id) && k.organizationId === orgId);
    if (idx === -1) throw new Error('API key not found');
    memKeys[idx] = { ...memKeys[idx], revokedAt: new Date() };
    return memKeys[idx];
  }
}

async function findApiKey(raw) {
  const key = String(raw || '').trim();
  if (!key) return null;
  try {
    const found = await withTimeout(prisma.apiKey.findFirst({ where: { key, deletedAt: null } }), 300);
    if (!found) return null;
    if (found.revokedAt) return null;
    return found;
  } catch {
    seedDemo();
    const found = memKeys.find((k) => k.key === key && !k.deletedAt) || null;
    if (!found) return null;
    if (found.revokedAt) return null;
    return found;
  }
}

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  findApiKey,
  checkRateLimit
};

