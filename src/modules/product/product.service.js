const prisma = require('../../config/prisma');

const memProducts = [];
const memBatches = [];

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function notDeleted(where) {
  return { ...where, deletedAt: null };
}

// Product Services
async function createProduct(data) {
  try {
    return await withTimeout(
      prisma.product.create({
        data: {
          organizationId: Number(data.organizationId),
          name: data.name,
          code: data.code
        }
      }),
      300
    );
  } catch {
    const next = {
      id: Date.now(),
      organizationId: Number(data.organizationId),
      name: data.name,
      code: data.code,
      batches: [],
      versionNo: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
    memProducts.unshift(next);
    return next;
  }
}

async function getAllProducts({ organizationId }) {
  try {
    return await withTimeout(
      prisma.product.findMany({
        where: notDeleted({ organizationId: Number(organizationId) }),
        include: { batches: true }
      }),
      250
    );
  } catch {
    return memProducts
      .filter((p) => p.organizationId === Number(organizationId) && !p.deletedAt)
      .map((p) => ({ ...p, batches: memBatches.filter((b) => b.productId === p.id && !b.deletedAt) }));
  }
}

async function getProductById(id) {
  return prisma.product.findUnique({
    where: { id: parseInt(id) },
    include: { batches: true }
  });
}

// Batch Services
async function createBatch(data) {
  try {
    return await withTimeout(
      prisma.batch.create({
        data: {
          organizationId: Number(data.organizationId),
          batchNo: data.batchNo,
          productId: parseInt(data.productId)
        }
      }),
      300
    );
  } catch {
    const next = {
      id: Date.now(),
      organizationId: Number(data.organizationId),
      batchNo: data.batchNo,
      productId: parseInt(data.productId),
      certificates: [],
      versionNo: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
    memBatches.unshift(next);
    return next;
  }
}

async function getBatchesByProduct({ organizationId, productId }) {
  try {
    return await withTimeout(
      prisma.batch.findMany({
        where: notDeleted({ organizationId: Number(organizationId), productId: parseInt(productId) }),
        include: { certificates: true }
      }),
      250
    );
  } catch {
    return memBatches.filter(
      (b) => b.organizationId === Number(organizationId) && b.productId === parseInt(productId) && !b.deletedAt
    );
  }
}

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  createBatch,
  getBatchesByProduct
};
