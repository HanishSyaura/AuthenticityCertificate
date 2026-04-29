const prisma = require('../../config/prisma');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function notDeleted(where) {
  return { ...where, deletedAt: null };
}

// Product Services
async function createProduct(data) {
  return await withTimeout(
    prisma.product.create({
      data: {
        organizationId: Number(data.organizationId),
        name: data.name,
        code: data.code,
        origin: data.origin || null,
        description: data.description || null,
        cmsPageId: data.cmsPageId ?? null,
        certificateTemplateId: data.certificateTemplateId ?? null
      }
    }),
    1200
  );
}

async function getAllProducts({ organizationId }) {
  return await withTimeout(
    prisma.product.findMany({
      where: notDeleted({ organizationId: Number(organizationId) }),
      include: { batches: true }
    }),
    1200
  );
}

async function getProductById(id) {
  return prisma.product.findUnique({
    where: { id: parseInt(id) },
    include: { batches: true }
  });
}

async function updateProduct({ organizationId, productId, patch }) {
  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.code !== undefined) data.code = patch.code;
  if (patch.origin !== undefined) data.origin = patch.origin;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.cmsPageId !== undefined) data.cmsPageId = patch.cmsPageId;
  if (patch.certificateTemplateId !== undefined) data.certificateTemplateId = patch.certificateTemplateId;

  const res = await withTimeout(
    prisma.product.updateMany({
      where: notDeleted({ id: Number(productId), organizationId: Number(organizationId) }),
      data
    }),
    1500
  );
  if (!res.count) throw new Error('Product not found');
  return await withTimeout(
    prisma.product.findUnique({ where: { id: Number(productId) }, include: { batches: true } }),
    1200
  );
}

async function deactivateProduct({ organizationId, productId }) {
  const res = await withTimeout(
    prisma.product.updateMany({
      where: notDeleted({ id: Number(productId), organizationId: Number(organizationId) }),
      data: { deletedAt: new Date() }
    }),
    1500
  );
  if (!res.count) throw new Error('Product not found');
  return await withTimeout(prisma.product.findUnique({ where: { id: Number(productId) }, include: { batches: true } }), 1200);
}

// Batch Services
async function createBatch(data) {
  return await withTimeout(
    prisma.batch.create({
      data: {
        organizationId: Number(data.organizationId),
        batchNo: data.batchNo,
        productId: parseInt(data.productId)
      }
    }),
    1200
  );
}

async function getBatchesByProduct({ organizationId, productId }) {
  return await withTimeout(
    prisma.batch.findMany({
      where: notDeleted({ organizationId: Number(organizationId), productId: parseInt(productId) }),
      include: { certificates: true }
    }),
    1200
  );
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deactivateProduct,
  createBatch,
  getBatchesByProduct
};
