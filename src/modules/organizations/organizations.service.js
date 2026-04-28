const prisma = require('../../config/prisma');

const memOrgs = [
  {
    id: 1,
    name: 'Demo Organization',
    code: 'DEMO',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  }
];

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
    updatedAt: org.updatedAt,
    deletedAt: org.deletedAt
  };
}

async function listOrganizations() {
  try {
    const orgs = await withTimeout(prisma.organization.findMany({ orderBy: { createdAt: 'desc' } }), 80);
    return orgs.map(sanitize);
  } catch {
    return memOrgs.map(sanitize);
  }
}

async function createOrganization({ name, code }) {
  try {
    const org = await withTimeout(
      prisma.organization.create({
        data: { name, code }
      }),
      120
    );
    return sanitize(org);
  } catch {
    const next = {
      id: Date.now(),
      name,
      code,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
    memOrgs.unshift(next);
    return sanitize(next);
  }
}

async function getByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  try {
    const org = await withTimeout(prisma.organization.findUnique({ where: { code: c } }), 80);
    return sanitize(org);
  } catch {
    return sanitize(memOrgs.find((o) => o.code === c) || null);
  }
}

module.exports = {
  listOrganizations,
  createOrganization,
  getByCode
};
