const prisma = require('../config/prisma');

const MAX_AUDIT = 5000;
const audits = [];

function normalizeIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

async function tryPersist(entry) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        actorEmail: entry.actorEmail ?? null,
        organizationId: entry.organizationId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ?? null
      }
    });
  } catch {
  }
}

async function writeAudit({ req, action, targetType, targetId, metadata }) {
  const timestamp = Date.now();
  const entry = {
    id: `${action}-${Math.random().toString(16).slice(2)}-${timestamp}`,
    action,
    targetType: targetType || null,
    targetId: targetId || null,
    userId: typeof req.user?.id === 'number' ? req.user.id : null,
    actorEmail: req.user?.email || null,
    organizationId: typeof req.organization?.id === 'number' ? req.organization.id : null,
    ip: normalizeIp(req),
    userAgent: req.get('user-agent') || null,
    metadata: metadata || null,
    timestamp
  };

  audits.push(entry);
  if (audits.length > MAX_AUDIT) audits.splice(0, audits.length - MAX_AUDIT);
  void tryPersist(entry);

  return entry;
}

async function listAudits({ limit = 200, offset = 0 } = {}) {
  const l = Math.max(1, Math.min(1000, Number(limit) || 200));
  const o = Math.max(0, Number(offset) || 0);

  try {
    const [total, rows] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: o,
        take: l
      })
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      userId: r.userId,
      actorEmail: r.actorEmail,
      organizationId: r.organizationId,
      ip: r.ip,
      userAgent: r.userAgent,
      metadata: r.metadata,
      timestamp: r.createdAt ? new Date(r.createdAt).getTime() : null,
      createdAt: r.createdAt
    }));

    return { total, items };
  } catch {
    const ordered = [...audits].sort((a, b) => b.timestamp - a.timestamp);
    return { total: ordered.length, items: ordered.slice(o, o + l) };
  }
}

function auditAction(action, { targetType, getTargetId, getMetadata } = {}) {
  return async (req, res, next) => {
    const finish = async () => {
      try {
        const status = res.statusCode;
        if (status >= 200 && status < 400) {
          await writeAudit({
            req,
            action,
            targetType,
            targetId: typeof getTargetId === 'function' ? getTargetId(req, res) : null,
            metadata: typeof getMetadata === 'function' ? getMetadata(req, res) : null
          });
        }
      } catch {
      }
    };

    res.on('finish', finish);
    next();
  };
}

module.exports = {
  writeAudit,
  listAudits,
  auditAction
};
