const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function sanitizeUser(u) {
  if (!u) return null;
  if (u.id == null || !Number.isFinite(Number(u.id))) return null;
  const roleNamesFromJoin = Array.isArray(u.roles)
    ? u.roles
        .map((ur) => ur?.role?.name)
        .filter((v) => typeof v === 'string' && v.trim())
        .map((v) => v.trim())
    : [];
  const roles = roleNamesFromJoin.length > 0 ? Array.from(new Set(roleNamesFromJoin)) : u.role ? [u.role] : [];
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roles,
    mustResetPassword: Boolean(u.mustResetPassword),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
}

async function listUsers() {
  const users = await withTimeout(
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        roles: { select: { role: { select: { id: true, name: true } } } }
      }
    }),
    2000
  );
  return users.map(sanitizeUser).filter(Boolean);
}

function parseUserId(id) {
  const uid = Number(id);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error('Invalid user id');
  return uid;
}

async function createUser({ name, email, password, role, mustResetPassword }) {
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = await withTimeout(
      tx.user.create({
        data: {
          name,
          email,
          password: hashed,
          role,
          mustResetPassword: Boolean(mustResetPassword)
        }
      }),
      1500
    );

    try {
      const sysRole = await tx.role.findUnique({ where: { name: String(role || '').trim() } });
      if (sysRole) {
        await tx.userRole.create({ data: { userId: created.id, roleId: sysRole.id } });
      }
    } catch {
    }

    const full = await tx.user.findUnique({
      where: { id: created.id },
      include: { roles: { select: { role: { select: { id: true, name: true } } } } }
    });
    return full || created;
  });
  return sanitizeUser(user);
}

async function updateUserRole({ id, role }) {
  const uid = parseUserId(id);
  const user = await prisma.$transaction(async (tx) => {
    const updated = await withTimeout(
      tx.user.update({
        where: { id: uid },
        data: { role }
      }),
      1500
    );

    try {
      await tx.userRole.deleteMany({ where: { userId: uid } });
      const sysRole = await tx.role.findUnique({ where: { name: String(role || '').trim() } });
      if (sysRole) await tx.userRole.create({ data: { userId: uid, roleId: sysRole.id } });
    } catch {
    }

    const full = await tx.user.findUnique({
      where: { id: uid },
      include: { roles: { select: { role: { select: { id: true, name: true } } } } }
    });
    return full || updated;
  });
  return sanitizeUser(user);
}

async function deleteUser({ id }) {
  const uid = parseUserId(id);
  await prisma.$transaction(async (tx) => {
    const existing = await withTimeout(tx.user.findUnique({ where: { id: uid }, select: { id: true } }), 1200);
    if (!existing) throw new Error('User not found');
    await tx.auditLog.updateMany({ where: { userId: uid }, data: { userId: null } });
    await tx.fraudFlag.updateMany({ where: { resolvedByUserId: uid }, data: { resolvedByUserId: null } });
    await tx.userRole.deleteMany({ where: { userId: uid } });
    await tx.user.delete({ where: { id: uid } });
  });
  return { id: uid, deleted: true };
}

async function setUserPassword({ id, password, mustResetPassword }) {
  const hashed = await bcrypt.hash(password, 10);
  const uid = parseUserId(id);
  const user = await withTimeout(
    prisma.user.update({
      where: { id: uid },
      data: { password: hashed, mustResetPassword: typeof mustResetPassword === 'boolean' ? mustResetPassword : undefined }
    }),
    1500
  );
  return sanitizeUser(user);
}

async function setUserRoles({ id, roleIds }) {
  const uid = parseUserId(id);
  const ids = Array.isArray(roleIds) ? roleIds.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0) : [];

  const user = await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: uid } });
    for (const rid of Array.from(new Set(ids))) {
      await tx.userRole.create({ data: { userId: uid, roleId: rid } });
    }
    const full = await tx.user.findUnique({
      where: { id: uid },
      include: { roles: { select: { role: { select: { id: true, name: true } } } } }
    });
    return full;
  });

  return sanitizeUser(user);
}

module.exports = {
  listUsers,
  createUser,
  updateUserRole,
  deleteUser,
  setUserPassword,
  setUserRoles
};
