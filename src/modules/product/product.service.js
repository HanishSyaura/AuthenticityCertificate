const prisma = require('../../config/prisma');

async function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), ms))]);
}

function withSkuFallback(row) {
  if (!row) return row;
  if (row.sku) return row;
  const code = row.code ? String(row.code) : '';
  const sku = code || `SKU-${row.id}`;
  return { ...row, sku };
}

async function resolveProductTableName() {
  const rows = await prisma.$queryRaw`
    SELECT TABLE_NAME AS name
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('Product', 'Products')
    ORDER BY TABLE_NAME = 'Product' DESC
    LIMIT 1
  `;
  return rows?.[0]?.name || null;
}

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT COLUMN_NAME AS name
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
  `;
  return new Set(rows.map((r) => r.name).filter(Boolean));
}

function normalizeRawProduct(row) {
  const p = withSkuFallback(row);
  return {
    id: p.id ?? null,
    organizationId: p.organizationId ?? null,
    sku: p.sku ?? null,
    name: p.name ?? '',
    code: p.code ?? '',
    category: p.category ?? 'general',
    status: p.status ?? 'active',
    remark: p.remark ?? null,
    origin: p.origin ?? null,
    description: p.description ?? null,
    cmsPageId: p.cmsPageId ?? null,
    cmsCertificatePageId: p.cmsCertificatePageId ?? null,
    certificateTemplateId: p.certificateTemplateId ?? null,
    versionNo: p.versionNo ?? 1,
    createdAt: p.createdAt ?? null,
    updatedAt: p.updatedAt ?? null
  };
}

async function rawListProducts({ organizationId, status }) {
  const tableName = await resolveProductTableName();
  if (!tableName) return [];
  const cols = await getTableColumns(tableName);
  const statusFilter = status && String(status).toLowerCase() !== 'all' ? String(status).toLowerCase() : null;

  const desired = [
    'id',
    'organizationId',
    'sku',
    'name',
    'code',
    'category',
    'status',
    'remark',
    'origin',
    'description',
    'cmsPageId',
    'cmsCertificatePageId',
    'certificateTemplateId',
    'versionNo',
    'createdAt',
    'updatedAt'
  ];
  const selected = desired.filter((c) => cols.has(c));
  if (selected.length === 0) return [];

  const where = [];
  const args = [];

  if (cols.has('organizationId') && organizationId != null) {
    where.push('`organizationId` = ?');
    args.push(Number(organizationId));
  }
  if (statusFilter && cols.has('status')) {
    where.push('`status` = ?');
    args.push(statusFilter);
  }

  const orderBy = cols.has('createdAt') ? ' ORDER BY `createdAt` DESC' : cols.has('id') ? ' ORDER BY `id` DESC' : '';
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT ${selected.map((c) => `\`${c}\``).join(', ')} FROM \`${tableName}\`${whereSql}${orderBy}`;

  const rows = await withTimeout(prisma.$queryRawUnsafe(sql, ...args), 1200);
  return Array.isArray(rows) ? rows.map(normalizeRawProduct) : [];
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
  cmsCertificatePageId: true,
  certificateTemplateId: true,
  versionNo: true,
  createdAt: true,
  updatedAt: true
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
        cmsCertificatePageId: null,
        certificateTemplateId: null
      }
    }),
    1200
  );
}

async function getAllProducts({ organizationId, status }) {
  try {
    const statusFilter = status && String(status).toLowerCase() !== 'all' ? String(status).toLowerCase() : null;
    const rows = await withTimeout(
      prisma.product.findMany({
        where: {
          organizationId: Number(organizationId),
          ...(statusFilter ? { status: statusFilter } : {})
        },
        orderBy: { createdAt: 'desc' }
      }),
      1200
    );
    return rows.map(withSkuFallback);
  } catch (e) {
    if (e?.code === 'P2022') return await rawListProducts({ organizationId, status });
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
        where: { productId: parseInt(id), organizationId: Number(product.organizationId) },
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
  if (patch.cmsPageId !== undefined) data.cmsPageId = patch.cmsPageId == null ? null : Number(patch.cmsPageId);
  if (patch.cmsCertificatePageId !== undefined) data.cmsCertificatePageId = patch.cmsCertificatePageId == null ? null : Number(patch.cmsCertificatePageId);
  if (patch.certificateTemplateId !== undefined) data.certificateTemplateId = patch.certificateTemplateId == null ? null : Number(patch.certificateTemplateId);

  const res = await withTimeout(
    prisma.product.updateMany({
      where: { id: Number(productId), organizationId: Number(organizationId) },
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
          where: { productId: Number(productId), organizationId: Number(organizationId) },
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
      where: { id: Number(productId), organizationId: Number(organizationId) },
      data: { status: 'inactive' }
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
          where: { productId: Number(productId), organizationId: Number(organizationId) },
          include: { certificates: true }
        }),
        1200
      );
      return { ...withSkuFallback(product), batches };
    }
    throw e;
  }
}

async function activateProduct({ organizationId, productId }) {
  const res = await withTimeout(
    prisma.product.updateMany({
      where: { id: Number(productId), organizationId: Number(organizationId) },
      data: { status: 'active' }
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
          where: { productId: Number(productId), organizationId: Number(organizationId) },
          include: { certificates: true }
        }),
        1200
      );
      return { ...withSkuFallback(product), batches };
    }
    throw e;
  }
}

async function deleteProduct({ organizationId, productId }) {
  const existing = await withTimeout(
    prisma.product.findFirst({
      where: { id: Number(productId), organizationId: Number(organizationId) },
      select: { id: true, status: true }
    }),
    1200
  );
  if (!existing) throw new Error('Product not found');
  if (String(existing.status || '').toLowerCase() !== 'inactive') throw new Error('Product must be inactive before delete');

  await prisma.$transaction(async (tx) => {
    const batchIds = (
      await tx.batch.findMany({
        where: { organizationId: Number(organizationId), productId: Number(productId) },
        select: { id: true }
      })
    ).map((r) => r.id);

    if (batchIds.length) {
      const certIds = (
        await tx.certificate.findMany({
          where: { batchId: { in: batchIds } },
          select: { certificateId: true }
        })
      ).map((r) => r.certificateId);

      if (certIds.length) {
        await tx.scanLog.deleteMany({ where: { certificateId: { in: certIds } } });
        await tx.fraudFlag.deleteMany({ where: { certificateId: { in: certIds } } });
        await tx.tagIdentity.deleteMany({ where: { certificateId: { in: certIds } } });
      }

      await tx.certificate.deleteMany({ where: { batchId: { in: batchIds } } });
      await tx.batch.deleteMany({ where: { id: { in: batchIds } } });
    }

    const epcBatchIds = (
      await tx.epcBatch.findMany({
        where: { organizationId: Number(organizationId), productId: Number(productId) },
        select: { id: true }
      })
    ).map((r) => r.id);

    if (epcBatchIds.length) {
      await tx.epcItem.deleteMany({ where: { batchId: { in: epcBatchIds } } });
      await tx.epcBatch.deleteMany({ where: { id: { in: epcBatchIds } } });
    }

    const res = await tx.product.deleteMany({
      where: { id: Number(productId), organizationId: Number(organizationId), status: 'inactive' }
    });
    if (!res.count) throw new Error('Product not found');
  });

  return { id: Number(productId), deleted: true };
}

async function deleteProductsBulk({ organizationId, productIds }) {
  const ids = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0)
    )
  );
  if (!ids.length) return { deletedIds: [], notFoundIds: [], notInactiveIds: [] };

  const existing = await withTimeout(
    prisma.product.findMany({
      where: { id: { in: ids }, organizationId: Number(organizationId) },
      select: { id: true, status: true }
    }),
    1200
  );

  const existingIdSet = new Set(existing.map((r) => Number(r.id)));
  const notFoundIds = ids.filter((id) => !existingIdSet.has(Number(id)));
  const notInactiveIds = existing
    .filter((r) => String(r.status || '').toLowerCase() !== 'inactive')
    .map((r) => Number(r.id));
  const deletableIds = existing
    .filter((r) => String(r.status || '').toLowerCase() === 'inactive')
    .map((r) => Number(r.id));

  if (deletableIds.length) {
    await prisma.$transaction(async (tx) => {
      const batchIds = (
        await tx.batch.findMany({
          where: { organizationId: Number(organizationId), productId: { in: deletableIds } },
          select: { id: true }
        })
      ).map((r) => r.id);

      if (batchIds.length) {
        const certIds = (
          await tx.certificate.findMany({
            where: { batchId: { in: batchIds } },
            select: { certificateId: true }
          })
        ).map((r) => r.certificateId);

        if (certIds.length) {
          await tx.scanLog.deleteMany({ where: { certificateId: { in: certIds } } });
          await tx.fraudFlag.deleteMany({ where: { certificateId: { in: certIds } } });
          await tx.tagIdentity.deleteMany({ where: { certificateId: { in: certIds } } });
        }

        await tx.certificate.deleteMany({ where: { batchId: { in: batchIds } } });
        await tx.batch.deleteMany({ where: { id: { in: batchIds } } });
      }

      const epcBatchIds = (
        await tx.epcBatch.findMany({
          where: { organizationId: Number(organizationId), productId: { in: deletableIds } },
          select: { id: true }
        })
      ).map((r) => r.id);

      if (epcBatchIds.length) {
        await tx.epcItem.deleteMany({ where: { batchId: { in: epcBatchIds } } });
        await tx.epcBatch.deleteMany({ where: { id: { in: epcBatchIds } } });
      }

      await tx.product.deleteMany({
        where: { id: { in: deletableIds }, organizationId: Number(organizationId), status: 'inactive' }
      });
    });
  }

  return { deletedIds: deletableIds, notFoundIds, notInactiveIds };
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
      where: { organizationId: Number(organizationId), productId: parseInt(productId) },
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
  activateProduct,
  deleteProduct,
  deleteProductsBulk,
  createBatch,
  getBatchesByProduct
};
