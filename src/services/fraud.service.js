const prisma = require('../config/prisma');
const webhookService = require('./webhook.service');

const MAX_FLAGS = 5000;
const flags = [];

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function normalizeSeverity(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function makeReason(scanEntry) {
  const parts = [];
  if (scanEntry?.riskFlags?.length) parts.push(scanEntry.riskFlags.join(','));
  if (scanEntry?.riskScore != null) parts.push(`score:${scanEntry.riskScore}`);
  return parts.length ? `auto:${parts.join('|')}` : 'auto';
}

function hasRecentOpen({ organizationId, certificateId, windowMs = 30 * 60 * 1000 }) {
  const cutoff = Date.now() - windowMs;
  for (let i = flags.length - 1; i >= 0; i--) {
    const f = flags[i];
    if (f.createdAtMs < cutoff) break;
    if (f.organizationId !== Number(organizationId)) continue;
    if (f.certificateId !== String(certificateId)) continue;
    if (f.status === 'open') return true;
  }
  return false;
}

async function tryPersistCreate(entry) {
  try {
    await prisma.fraudFlag.create({
      data: {
        organizationId: entry.organizationId,
        certificateId: entry.certificateId,
        reason: entry.reason,
        severity: entry.severity,
        status: entry.status
      }
    });
  } catch {
  }
}

async function createFlag({ organizationId, certificateId, reason, severity = 'medium' }) {
  const now = Date.now();
  const entry = {
    id: `${certificateId}-${Math.random().toString(16).slice(2)}-${now}`,
    organizationId: Number(organizationId),
    certificateId: String(certificateId),
    reason: String(reason || 'manual'),
    severity: severity,
    status: 'open',
    createdAtMs: now,
    createdAt: new Date(now),
    resolvedAt: null,
    resolvedByUserId: null
  };

  flags.push(entry);
  if (flags.length > MAX_FLAGS) flags.splice(0, flags.length - MAX_FLAGS);
  void tryPersistCreate(entry);

  void webhookService.emitEvent({
    organizationId: entry.organizationId,
    event: 'fraud_flag_created',
    data: {
      certificateId: entry.certificateId,
      severity: entry.severity,
      reason: entry.reason
    }
  });

  return entry;
}

async function autoFlagIfNeeded({ organizationId, certificateId, scanEntry }) {
  const score = Number(scanEntry?.riskScore || 0);
  const suspicious = !!scanEntry?.suspicious || score >= 50;
  if (!suspicious) return null;
  if (hasRecentOpen({ organizationId, certificateId })) return null;
  const severity = normalizeSeverity(score);
  const reason = makeReason(scanEntry);
  return await createFlag({ organizationId, certificateId, reason, severity });
}

async function listFlags({ organizationId, status = 'open', limit = 200, offset = 0 }) {
  const orgId = Number(organizationId);
  const l = Math.max(1, Math.min(1000, Number(limit) || 200));
  const o = Math.max(0, Number(offset) || 0);

  try {
    const rows = await withTimeout(
      prisma.fraudFlag.findMany({
        where: { organizationId: orgId, status: status || undefined },
        orderBy: { createdAt: 'desc' },
        skip: o,
        take: l
      }),
      300
    );
    const total = await withTimeout(
      prisma.fraudFlag.count({ where: { organizationId: orgId, status: status || undefined } }),
      300
    );
    return { total, items: rows };
  } catch {
    const items = flags
      .filter((f) => f.organizationId === orgId && (!status || f.status === status))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    return { total: items.length, items: items.slice(o, o + l) };
  }
}

async function resolveFlag({ organizationId, id, userId }) {
  const orgId = Number(organizationId);
  const now = new Date();
  try {
    const updated = await withTimeout(
      prisma.fraudFlag.update({
        where: { id: Number(id) },
        data: { status: 'resolved', resolvedAt: now, resolvedByUserId: userId ? Number(userId) : null }
      }),
      300
    );
    return updated;
  } catch {
    const idx = flags.findIndex((f) => String(f.id) === String(id) && f.organizationId === orgId);
    if (idx === -1) throw new Error('Flag not found');
    flags[idx] = { ...flags[idx], status: 'resolved', resolvedAt: now, resolvedByUserId: userId ? Number(userId) : null };
    return flags[idx];
  }
}

module.exports = {
  autoFlagIfNeeded,
  createFlag,
  listFlags,
  resolveFlag
};
