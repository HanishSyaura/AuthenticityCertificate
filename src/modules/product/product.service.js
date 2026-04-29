const prisma = require('../../config/prisma');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function notDeleted(where) {
  return { ...where, deletedAt: null };
}

function withSkuFallback(row) {
  if (!row) return row;
  if (row.sku) return row;
  const code = row.code ? String(row.code) : '';
  const sku = code || `SKU-${row.id}`;
  return { ...row, sku };
}

const productSelectWithoutSku = {
  id: true,
  organizationId: true,
  name: true,
  code: true,
  category: true,
  status: true,
  remark: true,
  origin: true,
  description: true,
  cmsPageId: true,
  certificateTemplateId: true,
  versionNo: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true
};

// Product Services
async function createProduct(data) {
  return await withTimeout(
    prisma.product.create({
      data: {
        organizationId: Number(data.organizationId),
        sku: data.sku,
        name: data.name,
        code: data.product_code,
        category: data.category,
        status: data.status,
        remark: data.remark || null,
        origin: null,
        description: null,
        cmsPageId: null,
        certificateTemplateId: null
      }
    }),
    1200
  );
}

async function getAllProducts({ organizationId }) {
  try {
    const rows = await withTimeout(
      prisma.product.findMany({
        where: notDeleted({ organizationId: Number(organizationId) }),
        orderBy: { createdAt: 'desc' }
      }),
      1200
    );
    return rows.map(withSkuFallback);
  } catch (e) {
    if (e?.code === 'P2022' && String(e?.message || '').toLowerCase().includes('sku')) {
      const rows = await withTimeout(
        prisma.product.findMany({
          where: notDeleted({ organizationId: Number(organizationId) }),
          orderBy: { createdAt: 'desc' },
          select: productSelectWithoutSku
        }),
        1200
      );
      return rows.map(withSkuFallback);
    }
    throw e;
  }
}

async function getProductById(id) {
  try {
    const row = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { batches: true }
    });
    return row ? withSkuFallback(row) : row;
  } catch (e) {
    if (e?.code === 'P2022' && String(e?.message || '').toLowerCase().includes('sku')) {
      const product = await prisma.product.findUnique({
        where: { id: parseInt(id) },
        select: productSelectWithoutSku
      });
      if (!product) return product;
      const batches = await prisma.batch.findMany({
        where: notDeleted({ productId: parseInt(id), organizationId: Number(product.organizationId) }),
        include: { certificates: true }
      });
      return { ...withSkuFallback(product), batches };
    }
    throw e;
  }
}

async function updateProduct({ organizationId, productId, patch }) {
  const data = {};
  if (patch.sku !== undefined) data.sku = patch.sku;
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.product_code !== undefined) data.code = patch.product_code;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.remark !== undefined) data.remark = patch.remark;

  const res = await withTimeout(
    prisma.product.updateMany({
      where: notDeleted({ id: Number(productId), organizationId: Number(organizationId) }),
      data
    }),
    1500
  );
  if (!res.count) throw new Error('Product not found');
  try {
    const row = await withTimeout(prisma.product.findUnique({ where: { id: Number(productId) }, include: { batches: true } }), 1200);
    return row ? withSkuFallback(row) : row;
  } catch (e) {
    if (e?.code === 'P2022' && String(e?.message || '').toLowerCase().includes('sku')) {
      const product = await withTimeout(
        prisma.product.findUnique({ where: { id: Number(productId) }, select: productSelectWithoutSku }),
        1200
      );
      if (!product) return product;
      const batches = await withTimeout(
        prisma.batch.findMany({
          where: notDeleted({ productId: Number(productId), organizationId: Number(organizationId) }),
          include: { certificates: true }
        }),
        1200
      );
      return { ...withSkuFallback(product), batches };
    }
    throw e;
  }
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
  try {
    const row = await withTimeout(prisma.product.findUnique({ where: { id: Number(productId) }, include: { batches: true } }), 1200);
    return row ? withSkuFallback(row) : row;
  } catch (e) {
    if (e?.code === 'P2022' && String(e?.message || '').toLowerCase().includes('sku')) {
      const product = await withTimeout(
        prisma.product.findUnique({ where: { id: Number(productId) }, select: productSelectWithoutSku }),
        1200
      );
      if (!product) return product;
      const batches = await withTimeout(
        prisma.batch.findMany({
          where: notDeleted({ productId: Number(productId), organizationId: Number(organizationId) }),
          include: { certificates: true }
        }),
        1200
      );
      return { ...withSkuFallback(product), batches };
    }
    throw e;
  }
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
