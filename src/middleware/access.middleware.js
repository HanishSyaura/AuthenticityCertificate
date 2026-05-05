const prisma = require('../config/prisma');

const FALLBACK_ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'products.read',
    'products.write',
    'categories.read',
    'categories.write',
    'epc.read',
    'epc.write',
    'certificates.read',
    'certificates.write',
    'templates.read',
    'templates.write',
    'uploads.write',
    'organizations.read',
    'settings.read',
    'cms.read',
    'cms.write',
    'cms.publish',
    'cms.meta.write'
  ],
  operator: ['cms.read', 'cms.write']
};

function matchPermission(owned, required) {
  if (!required) return true;
  if (!Array.isArray(owned) || owned.length === 0) return false;
  if (owned.includes('*')) return true;
  if (owned.includes(required)) return true;

  const parts = String(required).split('.');
  if (parts.length <= 1) return false;
  return owned.some((p) => typeof p === 'string' && p.endsWith('.*') && required.startsWith(p.slice(0, -1)));
}

function hasAnyPermission(owned, requiredList) {
  const list = Array.isArray(requiredList) ? requiredList : [requiredList];
  return list.some((p) => matchPermission(owned, p));
}

async function resolvePermissionsFromRoleNames(roleNames) {
  const names = (Array.isArray(roleNames) ? roleNames : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (names.length === 0) return [];

  let roles = [];
  try {
    roles = await prisma.role.findMany({
      where: { name: { in: names } },
      select: {
        name: true,
        permissions: {
          select: {
            permission: { select: { key: true } }
          }
        }
      }
    });
  } catch {
    const keys = new Set();
    for (const n of names) {
      for (const p of FALLBACK_ROLE_PERMISSIONS[n] || []) keys.add(p);
    }
    return Array.from(keys);
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    const keys = new Set();
    for (const n of names) {
      for (const p of FALLBACK_ROLE_PERMISSIONS[n] || []) keys.add(p);
    }
    return Array.from(keys);
  }

  const keys = new Set();
  for (const r of roles) {
    for (const rp of r.permissions || []) {
      const k = rp?.permission?.key;
      if (typeof k === 'string' && k.trim()) keys.add(k.trim());
    }
  }
  return Array.from(keys);
}

async function resolveUserRoleNames(userId, fallbackRoleName) {
  const id = Number(userId);
  const fallback = String(fallbackRoleName || '').trim();

  if (!Number.isFinite(id) || id <= 0) return fallback ? [fallback] : [];

  let rows = [];
  try {
    rows = await prisma.userRole.findMany({
      where: { userId: id },
      select: { role: { select: { name: true } } }
    });
  } catch {
    return fallback ? [fallback] : [];
  }

  const names = rows
    .map((r) => r?.role?.name)
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim());

  if (names.length > 0) return Array.from(new Set(names));
  return fallback ? [fallback] : [];
}

async function attachAccessContext(req, res, next) {
  try {
    const tokenUser = req.user;
    const id = Number(tokenUser?.id);
    const email = String(tokenUser?.email || '').trim().toLowerCase();
    if (!Number.isFinite(id) || id <= 0 || !email) return res.error('Unauthorized', 401);

    let kind = 'user';
    let row = null;

    try {
      const u = await prisma.user.findUnique({ where: { id } });
      if (u && String(u.email || '').trim().toLowerCase() === email && !u.deletedAt) {
        row = u;
      }
    } catch {
    }

    if (!row) {
      try {
        const a = await prisma.admin.findUnique({ where: { id } });
        if (a && String(a.email || '').trim().toLowerCase() === email) {
          kind = 'admin';
          row = a;
        }
      } catch {
      }
    }

    if (!row) return res.error('Unauthorized', 401);

    const role = kind === 'user' ? row.role : 'admin';
    const organizationId = kind === 'user' ? row.organizationId ?? null : null;

    const roleNames = kind === 'user' ? await resolveUserRoleNames(row.id, role) : ['admin'];
    const permissions = await resolvePermissionsFromRoleNames(roleNames);

    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      role,
      kind,
      organizationId,
      roles: roleNames,
      permissions
    };

    next();
  } catch (e) {
    return res.error('Service temporarily unavailable', 503);
  }
}

function requirePermission(required) {
  const requiredList = Array.isArray(required) ? required : [required];
  return (req, res, next) => {
    const owned = req.user?.permissions || [];
    if (!hasAnyPermission(owned, requiredList)) return res.error('Insufficient permissions', 403);
    next();
  };
}

function requireAccess({ read, write }) {
  return (req, res, next) => {
    const method = String(req.method || '').toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    const required = isRead ? read : write;
    if (!required) return next();
    const owned = req.user?.permissions || [];
    if (!matchPermission(owned, required)) return res.error('Insufficient permissions', 403);
    next();
  };
}

module.exports = {
  attachAccessContext,
  requirePermission,
  requireAccess,
  matchPermission
};
