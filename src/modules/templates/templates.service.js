const prisma = require('../../config/prisma');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

async function listTemplates({ organizationId }) {
  return await withTimeout(
    prisma.certificateTemplate.findMany({
      where: { organizationId: Number(organizationId) },
      orderBy: { createdAt: 'desc' }
    }),
    1200
  );
}

async function createTemplate({ organizationId, certificateId, name, background, backgroundColor, layoutJson, placeholders, canvasWidth, canvasHeight }) {
  try {
    return await withTimeout(
      prisma.certificateTemplate.create({
        data: {
          organizationId: Number(organizationId),
          certificateId: String(certificateId || '').trim(),
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
  } catch (e) {
    if (e?.code === 'P2002') throw new Error('Certificate ID already exists');
    throw e;
  }
}

async function updateTemplate({ organizationId, id, patch }) {
  const data = {};
  if (patch.certificateId !== undefined) data.certificateId = String(patch.certificateId || '').trim();
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.background !== undefined) data.background = patch.background || '';
  if (patch.backgroundColor !== undefined) data.backgroundColor = String(patch.backgroundColor || '').trim() || '#ffffff';
  if (patch.layoutJson !== undefined) data.layoutJson = patch.layoutJson || [];
  if (patch.placeholders !== undefined) data.placeholders = patch.placeholders || null;
  if (patch.canvasWidth !== undefined) data.canvasWidth = patch.canvasWidth;
  if (patch.canvasHeight !== undefined) data.canvasHeight = patch.canvasHeight;

  let res;
  try {
    res = await withTimeout(
      prisma.certificateTemplate.updateMany({
        where: { id: Number(id), organizationId: Number(organizationId) },
        data
      }),
      1500
    );
  } catch (e) {
    if (e?.code === 'P2002') throw new Error('Certificate ID already exists');
    throw e;
  }
  if (!res.count) throw new Error('Template not found');
  return await withTimeout(prisma.certificateTemplate.findUnique({ where: { id: Number(id) } }), 1200);
}

async function deleteTemplate({ organizationId, id }) {
  const tplId = Number(id);
  const orgId = Number(organizationId);

  await prisma.$transaction(async (tx) => {
    const existing = await withTimeout(
      tx.certificateTemplate.findFirst({ where: { id: tplId, organizationId: orgId }, select: { id: true } }),
      1200
    );
    if (!existing) throw new Error('Template not found');

    await tx.product.updateMany({ where: { organizationId: orgId, certificateTemplateId: tplId }, data: { certificateTemplateId: null } });
    await tx.epcBatch.updateMany({ where: { organizationId: orgId, certificateTemplateId: tplId }, data: { certificateTemplateId: null } });
    await tx.certificateTemplate.deleteMany({ where: { id: tplId, organizationId: orgId } });
  });

  return { id: tplId };
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
