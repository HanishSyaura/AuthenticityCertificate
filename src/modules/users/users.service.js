const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');

const MAX_USERS = 2000;
const memUsers = [
  {
    id: 1,
    name: 'Demo Super Admin',
    email: 'admin@local.test',
    password: '$2a$10$gZ9fD4cYubXnS4dQfLx7Z.Fdjsm5H7zIu6S7QJjQh5gq9mH6lHjNy',
    role: 'super_admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  }
];

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
  try {
    const users = await withTimeout(prisma.user.findMany({ orderBy: { createdAt: 'desc' } }), 400);
    return users.map(sanitizeUser);
  } catch {
    return memUsers.map(sanitizeUser);
  }
}

async function createUser({ name, email, password, role }) {
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await withTimeout(
      prisma.user.create({
        data: {
          name,
          email,
          password: hashed,
          role
        }
      }),
      600
    );
    return sanitizeUser(user);
  } catch {
    const next = {
      id: Date.now(),
      name,
      email,
      password: hashed,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
    memUsers.unshift(next);
    if (memUsers.length > MAX_USERS) memUsers.splice(MAX_USERS);
    return sanitizeUser(next);
  }
}

async function updateUserRole({ id, role }) {
  try {
    const user = await withTimeout(
      prisma.user.update({
        where: { id: Number(id) },
        data: { role }
      }),
      600
    );
    return sanitizeUser(user);
  } catch {
    const idx = memUsers.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) throw new Error('User not found');
    memUsers[idx] = { ...memUsers[idx], role, updatedAt: new Date() };
    return sanitizeUser(memUsers[idx]);
  }
}

async function softDeleteUser({ id }) {
  try {
    const user = await withTimeout(
      prisma.user.update({
        where: { id: Number(id) },
        data: { deletedAt: new Date() }
      }),
      600
    );
    return sanitizeUser(user);
  } catch {
    const idx = memUsers.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) throw new Error('User not found');
    memUsers[idx] = { ...memUsers[idx], deletedAt: new Date(), updatedAt: new Date() };
    return sanitizeUser(memUsers[idx]);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUserRole,
  softDeleteUser
};
