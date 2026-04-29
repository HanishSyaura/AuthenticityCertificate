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

async function createTemplate({ organizationId, name, background, backgroundColor, layoutJson, placeholders, canvasWidth, canvasHeight }) {
  return await withTimeout(
    prisma.certificateTemplate.create({
      data: {
        organizationId: Number(organizationId),
        name,
        background: background || '',
        backgroundColor: String(backgroundColor || '').trim() || '#ffffff',
        layoutJson: layoutJson || [],
        placeholders: placeholders || null,
        canvasWidth: Number.isFinite(Number(canvasWidth)) && Number(canvasWidth) > 0 ? Number(canvasWidth) : 390,
        canvasHeight: Number.isFinite(Number(canvasHeight)) && Number(canvasHeight) > 0 ? Number(canvasHeight) : 844
      }
    }),
    1500
  );
}

async function updateTemplate({ organizationId, id, patch }) {
  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.background !== undefined) data.background = patch.background || '';
  if (patch.backgroundColor !== undefined) data.backgroundColor = String(patch.backgroundColor || '').trim() || '#ffffff';
  if (patch.layoutJson !== undefined) data.layoutJson = patch.layoutJson || [];
  if (patch.placeholders !== undefined) data.placeholders = patch.placeholders || null;
  if (patch.canvasWidth !== undefined) data.canvasWidth = patch.canvasWidth;
  if (patch.canvasHeight !== undefined) data.canvasHeight = patch.canvasHeight;

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
