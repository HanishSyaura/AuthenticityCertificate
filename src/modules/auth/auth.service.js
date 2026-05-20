const prisma = require('../../config/prisma');
const dbGate = require('../../services/dbGate.service');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function getDbTimeoutMs() {
  const raw = process.env.AUTH_DB_TIMEOUT_MS || process.env.DB_QUERY_TIMEOUT_MS;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : 5000;
}

function isPrismaError(err) {
  return typeof err?.name === 'string' && err.name.startsWith('Prisma');
}

async function login(email, password) {
  let user = null;
  let role = null;
  const dbTimeoutMs = getDbTimeoutMs();

  try {
    if (!dbGate.shouldUseDb()) throw new Error('db_unavailable');
    user = await withTimeout(prisma.user.findUnique({ where: { email } }), dbTimeoutMs);
    if (user) role = user.role;
    dbGate.markDbSuccess();
  } catch (e) {
    if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000, error: e });
    throw e?.message === 'db_unavailable' ? e : e?.message === 'db_timeout' ? e : isPrismaError(e) ? e : new Error('db_timeout');
  }

  if (!user) {
    try {
      if (!dbGate.shouldUseDb()) throw new Error('db_unavailable');
      const admin = await withTimeout(
        prisma.admin.findUnique({
          where: { email }
        }),
        dbTimeoutMs
      );
      if (admin) {
        user = admin;
        role = 'admin';
      }
      dbGate.markDbSuccess();
    } catch (e) {
      if (e?.message === 'db_timeout' || isPrismaError(e)) dbGate.markDbFailure({ cooldownMs: 10_000, error: e });
      throw e;
    }
  }

  if (!user) throw new Error('Invalid email or password');

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new Error('Invalid email or password');

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || !String(jwtSecret).trim()) throw new Error('jwt_secret_missing');
  const token = jwt.sign({ id: user.id, email: user.email, role }, String(jwtSecret), { expiresIn: '1d' });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      mustResetPassword: Boolean(user?.mustResetPassword)
    }
  };
}

async function resolveCurrentUser(tokenUser) {
  const id = Number(tokenUser?.id);
  const email = String(tokenUser?.email || '').trim().toLowerCase();
  if (!Number.isFinite(id) || id <= 0 || !email) return null;

  const dbTimeoutMs = getDbTimeoutMs();
  try {
    const u = await withTimeout(prisma.user.findUnique({ where: { id } }), dbTimeoutMs);
    if (u && String(u.email || '').trim().toLowerCase() === email) {
      return { kind: 'user', row: u };
    }
  } catch {
  }

  try {
    const a = await withTimeout(prisma.admin.findUnique({ where: { id } }), dbTimeoutMs);
    if (a && String(a.email || '').trim().toLowerCase() === email) {
      return { kind: 'admin', row: a };
    }
  } catch {
  }

  return null;
}

async function getMe(tokenUser) {
  const resolved = await resolveCurrentUser(tokenUser);
  if (!resolved) return null;

  const role = resolved.kind === 'user' ? resolved.row.role : 'admin';
  return {
    id: resolved.row.id,
    email: resolved.row.email,
    name: resolved.row.name,
    role,
    mustResetPassword: resolved.kind === 'user' ? Boolean(resolved.row.mustResetPassword) : false
  };
}

async function updateMe(tokenUser, input) {
  const resolved = await resolveCurrentUser(tokenUser);
  if (!resolved) throw new Error('Unauthorized');

  const role = resolved.kind === 'user' ? resolved.row.role : 'admin';
  const canEditEmail = role === 'super_admin' || role === 'admin';

  const update = {};
  if (typeof input.name === 'string') update.name = input.name.trim();
  if (typeof input.email === 'string') {
    if (!canEditEmail) throw new Error('Forbidden');
    update.email = input.email.trim().toLowerCase();
  }

  if (typeof input.newPassword === 'string' && input.newPassword.trim()) {
    const ok = await bcrypt.compare(String(input.currentPassword || ''), resolved.row.password);
    if (!ok) throw new Error('Invalid current password');
    update.password = await bcrypt.hash(String(input.newPassword), 10);
    if (resolved.kind === 'user') update.mustResetPassword = false;
  }

  if (Object.keys(update).length === 0) {
    const user = await getMe(tokenUser);
    return { user };
  }

  try {
    if (resolved.kind === 'user') {
      const saved = await withTimeout(
        prisma.user.update({ where: { id: resolved.row.id }, data: update }),
        getDbTimeoutMs()
      );
      return {
        user: {
          id: saved.id,
          email: saved.email,
          name: saved.name,
          role: saved.role,
          mustResetPassword: Boolean(saved.mustResetPassword)
        }
      };
    }

    const saved = await withTimeout(
      prisma.admin.update({ where: { id: resolved.row.id }, data: update }),
      getDbTimeoutMs()
    );
    return {
      user: {
        id: saved.id,
        email: saved.email,
        name: saved.name,
        role: 'admin',
        mustResetPassword: false
      }
    };
  } catch (e) {
    if (e?.code === 'P2002') throw new Error('Email already in use');
    throw e;
  }
}

module.exports = {
  login,
  getMe,
  updateMe
};
