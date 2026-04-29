const prisma = require('../src/config/prisma');
const bcrypt = require('bcryptjs');

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing ${name}`);
  return String(v).trim();
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const name = process.env.ADMIN_NAME && String(process.env.ADMIN_NAME).trim() ? String(process.env.ADMIN_NAME).trim() : 'Admin';
  const password = requireEnv('ADMIN_PASSWORD');
  const roleRaw = process.env.ADMIN_ROLE && String(process.env.ADMIN_ROLE).trim() ? String(process.env.ADMIN_ROLE).trim() : 'super_admin';
  const role = ['super_admin', 'admin', 'operator'].includes(roleRaw) ? roleRaw : 'super_admin';

  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  const hashed = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { name, password: hashed, role, deletedAt: null }
    });
    process.stdout.write(`Updated user: ${email}\n`);
    return;
  }

  await prisma.user.create({
    data: { email, name, password: hashed, role }
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

