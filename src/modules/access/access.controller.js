const { z } = require('zod');
const prisma = require('../../config/prisma');
const usersService = require('../users/users.service');

async function listAccessAuditLogs(req, res) {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.error('Organization context is required', 403);
    }

    const where = {
      organizationId,
      action: {
        in: [
          'CREATE_ROLE',
          'UPDATE_ROLE',
          'UPDATE_ROLE_PERMISSIONS',
          'DELETE_ROLE',
          'ASSIGN_USER_ROLES'
        ]
      }
    };

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      })
    ]);

    res.success({
      total,
      items: rows
    });
  } catch {
    res.error('Service temporarily unavailable', 503);
  }
}

async function listPermissions(req, res) {
  try {
    const rows = await prisma.permission.findMany({ orderBy: { key: 'asc' } });
    res.success(
      rows.map((p) => ({
        id: p.id,
        key: p.key,
        description: p.description || null
      }))
    );
  } catch {
    res.error('Service temporarily unavailable', 503);
  }
}

async function listRoles(req, res) {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        users: { select: { id: true } }
      }
    });

    res.success(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || null,
        isSystem: Boolean(r.isSystem),
        permissions: (r.permissions || [])
          .map((rp) => rp?.permission?.key)
          .filter((v) => typeof v === 'string' && v.trim())
          .map((v) => v.trim())
          .sort(),
        userCount: Array.isArray(r.users) ? r.users.length : 0
      }))
    );
  } catch {
    res.error('Service temporarily unavailable', 503);
  }
}

const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(64).regex(/^[a-z][a-z0-9_.-]+$/),
  description: z.string().trim().max(191).optional()
});

async function createRole(req, res) {
  try {
    const input = createRoleSchema.parse(req.body || {});
    const created = await prisma.role.create({
      data: {
        name: input.name,
        description: input.description || null,
        isSystem: false
      }
    });
    res.success(
      {
        id: created.id,
        name: created.name,
        description: created.description || null,
        isSystem: Boolean(created.isSystem),
        permissions: [],
        userCount: 0
      },
      'OK'
    );
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
    if (e?.code === 'P2002') return res.error('Role name already exists', 400);
    res.error('Service temporarily unavailable', 503);
  }
}

const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(64).regex(/^[a-z][a-z0-9_.-]+$/).optional(),
  description: z.string().trim().max(191).nullable().optional()
});

async function updateRole(req, res) {
  try {
    const roleId = Number(req.params.id);
    if (!Number.isFinite(roleId) || roleId <= 0) return res.error('Invalid role id', 400);
    const input = updateRoleSchema.parse(req.body || {});

    const existing = await prisma.role.findUnique({ where: { id: roleId } });
    if (!existing) return res.error('Role not found', 404);
    if (existing.isSystem && typeof input.name === 'string' && input.name !== existing.name) {
      return res.error('System role name cannot be changed', 400);
    }

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: typeof input.name === 'string' ? input.name : undefined,
        description: input.description === undefined ? undefined : input.description
      }
    });

    res.success(
      {
        id: updated.id,
        name: updated.name,
        description: updated.description || null,
        isSystem: Boolean(updated.isSystem)
      },
      'OK'
    );
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
    if (e?.code === 'P2002') return res.error('Role name already exists', 400);
    res.error('Service temporarily unavailable', 503);
  }
}

const setRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().trim().min(1).max(191)).max(500)
});

async function setRolePermissions(req, res) {
  try {
    const roleId = Number(req.params.id);
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return res.error('Invalid role id', 400);
    }

    const input = setRolePermissionsSchema.parse(req.body || {});
    const keys = Array.from(
      new Set(input.permissionKeys.map((k) => String(k).trim()).filter(Boolean))
    );

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return res.error('Role not found', 404);

    if (role.isSystem) {
      return res.error('System role permissions cannot be modified', 403);
    }

    const actorRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const isSuperAdmin =
      req.user?.role === 'super_admin' ||
      actorRoles.includes('super_admin');

    const restrictedKeys = ['*', 'access.manage', 'users.manage'];
    const requestedRestrictedKeys = keys.filter((key) =>
      restrictedKeys.includes(key)
    );

    if (requestedRestrictedKeys.length > 0 && !isSuperAdmin) {
      return res.error(
        'Only super administrators can grant administrative permissions',
        403
      );
    }

    const permissions = await prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true }
    });

    const foundKeys = new Set(permissions.map((p) => p.key));
    const unknownKeys = keys.filter((key) => !foundKeys.has(key));

    if (unknownKeys.length > 0) {
      return res.error(
        `Unknown permission keys: ${unknownKeys.join(', ')}`,
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id
          }))
        });
      }
    });

    res.success(
      { roleId, permissions: permissions.map((p) => p.key).sort() },
      'OK'
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.error(
        e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input',
        400
      );
    }
    res.error('Service temporarily unavailable', 503);
  }
}

async function deleteRole(req, res) {
  try {
    const roleId = Number(req.params.id);
    if (!Number.isFinite(roleId) || roleId <= 0) return res.error('Invalid role id', 400);

    const role = await prisma.role.findUnique({ where: { id: roleId }, include: { users: { select: { id: true } } } });
    if (!role) return res.error('Role not found', 404);
    if (role.isSystem) return res.error('System role cannot be deleted', 400);
    if (Array.isArray(role.users) && role.users.length > 0) return res.error('Role is assigned to users', 400);

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.userRole.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
    });
    res.success({ id: roleId, deleted: true }, 'OK');
  } catch {
    res.error('Service temporarily unavailable', 503);
  }
}

const setUserRolesSchema = z.object({
  roleIds: z.array(z.number().int().positive()).max(50)
});

async function setUserRoles(req, res) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0) return res.error('Invalid user id', 400);
    const input = setUserRolesSchema.parse(req.body || {});
    const updated = await usersService.setUserRoles({
      id: userId,
      roleIds: input.roleIds,
      actorRole: req.user?.role,
      actorRoles: req.user?.roles
    });
    if (!updated) return res.error('User not found', 404);
    res.success(updated, 'OK');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.issues?.[0]?.message || e.errors?.[0]?.message || 'Invalid input', 400);
    res.error('Service temporarily unavailable', 503);
  }
}

module.exports = {
  listAccessAuditLogs,
  listPermissions,
  listRoles,
  createRole,
  updateRole,
  setRolePermissions,
  deleteRole,
  setUserRoles
};

