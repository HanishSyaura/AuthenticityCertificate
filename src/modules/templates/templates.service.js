const prisma = require('../../config/prisma');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function notDeleted(where) {
  return { ...where, deletedAt: null };
}

async function listTemplates({ organizationId }) {
  return await withTimeout(
    prisma.certificateTemplate.findMany({
      where: notDeleted({ organizationId: Number(organizationId) }),
      orderBy: { createdAt: 'desc' }
    }),
    1200
  );
}

async function createTemplate({ organizationId, name, background, layoutJson }) {
  return await withTimeout(
    prisma.certificateTemplate.create({
      data: {
        organizationId: Number(organizationId),
        name,
        background: background || '',
        layoutJson: layoutJson || []
      }
    }),
    1500
  );
}

async function updateTemplate({ organizationId, id, patch }) {
  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.background !== undefined) data.background = patch.background || '';
  if (patch.layoutJson !== undefined) data.layoutJson = patch.layoutJson || [];

  const res = await withTimeout(
    prisma.certificateTemplate.updateMany({
      where: notDeleted({ id: Number(id), organizationId: Number(organizationId) }),
      data
    }),
    1500
  );
  if (!res.count) throw new Error('Template not found');
  return await withTimeout(prisma.certificateTemplate.findUnique({ where: { id: Number(id) } }), 1200);
}

async function deleteTemplate({ organizationId, id }) {
  const res = await withTimeout(
    prisma.certificateTemplate.updateMany({
      where: notDeleted({ id: Number(id), organizationId: Number(organizationId) }),
      data: { deletedAt: new Date() }
    }),
    1500
  );
  if (!res.count) throw new Error('Template not found');
  return { id: Number(id) };
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
};

