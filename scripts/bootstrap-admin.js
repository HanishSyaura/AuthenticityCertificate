require('dotenv').config();

const prisma = require('../src/config/prisma');
const bcrypt = require('bcryptjs');

function getEnv(name, fallback) {
  const v = process.env[name];
  if (!v || !String(v).trim()) return fallback;
  return String(v).trim();
}

async function main() {
  const email = getEnv('ADMIN_EMAIL', 'admin@company.com').toLowerCase();
  const name = getEnv('ADMIN_NAME', 'Super Admin');
  const password = getEnv('ADMIN_PASSWORD', 'Password123!');
  const roleRaw = getEnv('ADMIN_ROLE', 'super_admin');
  const role = ['super_admin', 'admin', 'operator'].includes(roleRaw) ? roleRaw : 'super_admin';
  const defaultOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });

  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  const hashed = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        name,
        password: hashed,
        role,
        deletedAt: null,
        mustResetPassword: false,
        ...(defaultOrg?.id ? { organizationId: defaultOrg.id } : {})
      }
    });
    process.stdout.write(`Updated user: ${email}\n`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      password: hashed,
      role,
      mustResetPassword: false,
      ...(defaultOrg?.id ? { organizationId: defaultOrg.id } : {})
    }
  });
  process.stdout.write(`Created user: ${email}\n`);
}

main()
  .catch((e) => {
    process.stderr.write(`${e?.message || e}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

