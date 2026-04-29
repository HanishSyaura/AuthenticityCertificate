const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function getDbTimeoutMs() {
  const raw = process.env.AUTH_DB_TIMEOUT_MS || process.env.DB_QUERY_TIMEOUT_MS;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms > 0 ? ms : 8000;
}

async function login(email, password) {
  let user = null;
  let role = null;
  const dbTimeoutMs = getDbTimeoutMs();

  try {
    user = await withTimeout(prisma.user.findUnique({ where: { email } }), dbTimeoutMs);
    if (user && user.deletedAt) user = null;
    if (user) role = user.role;
  } catch {
  }

  if (!user) {
    try {
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
    } catch (e) {
      throw e;
    }
  }

  if (!user) throw new Error('Invalid email or password');

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new Error('Invalid email or password');

  const token = jwt.sign({ id: user.id, email: user.email, role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role
    }
  };
}

module.exports = {
  login
};
