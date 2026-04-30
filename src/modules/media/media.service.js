const path = require('path');
const fs = require('fs/promises');
const prisma = require('../../config/prisma');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function getUploadsRoot() {
  return path.resolve(process.cwd(), 'uploads');
}

async function listMedia({ organizationId }) {
  return await withTimeout(
    prisma.mediaAsset.findMany({
      where: { organizationId: Number(organizationId) },
      orderBy: { createdAt: 'desc' }
    }),
    1200
  );
}

async function createMedia({ organizationId, originalName, fileName, mimeType, sizeBytes }) {
  const url = `/uploads/media/${Number(organizationId)}/${fileName}`;
  return await withTimeout(
    prisma.mediaAsset.create({
      data: {
        organizationId: Number(organizationId),
        originalName,
        fileName,
        mimeType,
        sizeBytes: Number(sizeBytes),
        url
      }
    }),
    1500
  );
}

async function deleteMedia({ organizationId, id }) {
  const asset = await withTimeout(
    prisma.mediaAsset.findFirst({ where: { id: Number(id), organizationId: Number(organizationId) } }),
    1200
  );
  if (!asset) throw new Error('Media not found');

  await withTimeout(prisma.mediaAsset.delete({ where: { id: Number(id) } }), 1200);

  const filePath = path.join(getUploadsRoot(), 'media', String(Number(organizationId)), asset.fileName);
  try {
    await fs.unlink(filePath);
  } catch {
  }

  return { id: Number(id) };
}

module.exports = {
  getUploadsRoot,
  listMedia,
  createMedia,
  deleteMedia
};
