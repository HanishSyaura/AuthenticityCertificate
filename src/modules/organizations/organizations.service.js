const prisma = require('../../config/prisma');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function sanitize(org) {
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    code: org.code,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt
  };
}

async function listOrganizations() {
  const orgs = await withTimeout(prisma.organization.findMany({ orderBy: { createdAt: 'desc' } }), 800);
  return orgs.map(sanitize);
}

async function createOrganization({ name, code }) {
  const org = await withTimeout(
    prisma.organization.create({
      data: { name, code }
    }),
    1200
  );
  return sanitize(org);
}

async function getByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  const org = await withTimeout(prisma.organization.findUnique({ where: { code: c } }), 800);
  return sanitize(org);
}

async function getOrCreateDefault() {
  const existing = await withTimeout(
    prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } }),
    1200
  );
  if (existing) return sanitize(existing);

  const code = String(process.env.SINGLE_ORG_CODE || 'MAIN').trim().toUpperCase();
  const name = String(process.env.SINGLE_ORG_NAME || 'Main Organization').trim();
  const created = await withTimeout(prisma.organization.create({ data: { code, name } }), 1500);
  return sanitize(created);
}

module.exports = {
  listOrganizations,
  createOrganization,
  getByCode,
  getOrCreateDefault
};
