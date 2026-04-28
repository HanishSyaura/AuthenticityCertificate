const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

async function login(email, password) {
  let user = null;
  let role = null;

  try {
    user = await withTimeout(prisma.user.findUnique({ where: { email } }), 600);
    if (user && user.deletedAt) user = null;
    if (user) role = user.role;
  } catch {
  }

  if (!user) {
    const admin = await withTimeout(
      prisma.admin.findUnique({
        where: { email }
      }),
      600
    );
    if (admin) {
      user = admin;
      role = 'admin';
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
