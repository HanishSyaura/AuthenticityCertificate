const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    deletedAt: u.deletedAt
  };
}

async function listUsers() {
  const users = await withTimeout(prisma.user.findMany({ orderBy: { createdAt: 'desc' } }), 1200);
  return users.map(sanitizeUser);
}

async function createUser({ name, email, password, role }) {
  const hashed = await bcrypt.hash(password, 10);
  const user = await withTimeout(
    prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role
      }
    }),
    1500
  );
  return sanitizeUser(user);
}

async function updateUserRole({ id, role }) {
  const user = await withTimeout(
    prisma.user.update({
      where: { id: Number(id) },
      data: { role }
    }),
    1500
  );
  return sanitizeUser(user);
}

async function softDeleteUser({ id }) {
  const user = await withTimeout(
    prisma.user.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date() }
    }),
    1500
  );
  return sanitizeUser(user);
}

async function setUserPassword({ id, password }) {
  const hashed = await bcrypt.hash(password, 10);
  const user = await withTimeout(
    prisma.user.update({
      where: { id: Number(id) },
      data: { password: hashed }
    }),
    1500
  );
  return sanitizeUser(user);
}

module.exports = {
  listUsers,
  createUser,
  updateUserRole,
  softDeleteUser,
  setUserPassword
};
