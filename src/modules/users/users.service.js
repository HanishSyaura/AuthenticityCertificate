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
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        roles: { select: { role: { select: { id: true, name: true } } } }
      }
    }),
    2000
  );
  return users.map(sanitizeUser).filter(Boolean);
}


function isSuperAdminActor({ actorRole, actorRoles }) {
  const roles = Array.isArray(actorRoles) ? actorRoles : [];
  return String(actorRole || '').trim() === 'super_admin' ||
    roles.some((role) => String(role || '').trim() === 'super_admin');
}

async function countSuperAdmins(tx) {
  return tx.user.count({
    where: {
      deletedAt: null,
      OR: [
        { role: 'super_admin' },
        { roles: { some: { role: { name: 'super_admin' } } } }
      ]
    }
  });
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



async function updateUserRole({ id, role, actorRole, actorRoles }) {
  if (role !== 'super_admin') {
    throw new Error('Legacy role endpoint only supports super_admin; use custom role assignment instead');
  }

  const uid = parseUserId(id);
  const actorIsSuperAdmin = isSuperAdminActor({ actorRole, actorRoles });

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: uid, deletedAt: null },
      include: { roles: { select: { role: { select: { name: true } } } } }
    });
    if (!existing) throw new Error('User not found');

    const currentlySuperAdmin =
      existing.role === 'super_admin' ||
      existing.roles.some((ur) => ur?.role?.name === 'super_admin');

    if ((role === 'super_admin' || currentlySuperAdmin) && !actorIsSuperAdmin) {
      throw new Error('Only a super admin can assign or remove the super_admin role');
    }

    if (currentlySuperAdmin && role !== 'super_admin') {
      if (await countSuperAdmins(tx) <= 1) {
        throw new Error('The last super admin cannot be demoted or removed');
      }
    }

    const systemRole = await tx.role.findUnique({ where: { name: role } });
    if (!systemRole) throw new Error('Requested system role is not configured');

    await tx.userRole.deleteMany({
      where: { userId: uid, role: { isSystem: true } }
    });

    await tx.userRole.create({
      data: { userId: uid, roleId: systemRole.id }
    });

    return tx.user.update({
      where: { id: uid },
      data: { role },
      include: { roles: { select: { role: { select: { id: true, name: true } } } } }
    });
  });

  return sanitizeUser(user);
}


async function deleteUser({ id, actorRole, actorRoles }) {
  const uid = parseUserId(id);
  const actorIsSuperAdmin = isSuperAdminActor({ actorRole, actorRoles });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: uid, deletedAt: null },
      include: { roles: { select: { role: { select: { name: true } } } } }
    });
    if (!existing) throw new Error('User not found');

    const isTargetSuperAdmin =
      existing.role === 'super_admin' ||
      existing.roles.some((ur) => ur?.role?.name === 'super_admin');

    if (isTargetSuperAdmin && !actorIsSuperAdmin) {
      throw new Error('Only a super admin can delete a super admin account');
    }

    if (isTargetSuperAdmin && await countSuperAdmins(tx) <= 1) {
      throw new Error('The last super admin account cannot be deleted');
    }

    await tx.user.update({
      where: { id: uid },
      data: { deletedAt: new Date() }
    });
  });

  return { id: uid, deleted: true };
}

async function setUserPassword({ id, password, mustResetPassword }) {
  const hashed = await bcrypt.hash(password, 10);
  const uid = parseUserId(id);
  const user = await withTimeout(
    prisma.user.update({
      where: { id: uid, deletedAt: null },
      data: { password: hashed, mustResetPassword: typeof mustResetPassword === 'boolean' ? mustResetPassword : undefined }
    }),
    1500
  );
  return sanitizeUser(user);
}



async function setUserRoles({ id, roleIds, actorRole, actorRoles }) {
  const uid = parseUserId(id);
  if (!Array.isArray(roleIds)) throw new Error('Role IDs must be an array');

  const ids = roleIds.map(Number);
  if (ids.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error('One or more role IDs are invalid');
  }

  const uniqueIds = Array.from(new Set(ids));
  const actorIsSuperAdmin = isSuperAdminActor({ actorRole, actorRoles });

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: uid, deletedAt: null },
      include: { roles: { select: { role: { select: { name: true } } } } }
    });
    if (!existing) return null;

    const requestedRoles = uniqueIds.length
      ? await tx.role.findMany({
          where: { id: { in: uniqueIds } },
          select: {
            id: true,
            name: true,
            isSystem: true,
            permissions: {
              select: {
                permission: { select: { key: true } }
              }
            }
          }
        })
      : [];

    if (requestedRoles.length !== uniqueIds.length) {
      throw new Error('One or more selected roles do not exist');
    }

    const restrictedKeys = new Set(['*', 'access.manage', 'users.manage']);
    const requestsRestrictedPermission = requestedRoles.some((role) =>
      (role.permissions || []).some((rp) =>
        restrictedKeys.has(rp?.permission?.key)
      )
    );

    if (requestsRestrictedPermission && !actorIsSuperAdmin) {
      throw new Error('Only a super admin can assign roles with restricted permissions');
    }

    const currentlySuperAdmin =
      existing.role === 'super_admin' ||
      existing.roles.some((ur) => ur?.role?.name === 'super_admin');

    const assigningSuperAdmin = requestedRoles.some((role) => role.name === 'super_admin');

    if ((assigningSuperAdmin || currentlySuperAdmin) && !actorIsSuperAdmin) {
      throw new Error('Only a super admin can assign or remove the super_admin role');
    }

    if (currentlySuperAdmin && !assigningSuperAdmin && await countSuperAdmins(tx) <= 1) {
      throw new Error('The last super admin cannot be demoted or removed');
    }

    const systemNames = new Set(
      requestedRoles.filter((role) => role.isSystem).map((role) => role.name)
    );

    let nextRole = 'operator';
    if (systemNames.has('super_admin')) nextRole = 'super_admin';

    await tx.userRole.deleteMany({ where: { userId: uid } });

    if (uniqueIds.length) {
      await tx.userRole.createMany({
        data: uniqueIds.map((roleId) => ({ userId: uid, roleId }))
      });
    }

    return tx.user.update({
      where: { id: uid },
      data: { role: nextRole },
      include: { roles: { select: { role: { select: { id: true, name: true } } } } }
    });
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
