const prisma = require('../../config/prisma');

function normalizeCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return '';
  return raw.toUpperCase();
}

function normalizeName(name) {
  return String(name || '').trim();
}

function toIsActive(status) {
  if (!status) return true;
  return String(status).toLowerCase() === 'active';
}

function notDeleted(where) {
  return { ...where, deletedAt: null };
}

async function getAllCategories({ organizationId }) {
  const rows = await prisma.category.findMany({
    where: notDeleted({ organizationId: Number(organizationId) }),
    orderBy: [{ name: 'asc' }, { code: 'asc' }]
  });
  return rows;
}

async function createCategory({ organizationId, name, code, status }) {
  const normalizedName = normalizeName(name);
  const normalizedCode = normalizeCode(code);
  if (!normalizedName) throw new Error('Category name is required');
  if (!normalizedCode) throw new Error('Category code is required');

  try {
    const row = await prisma.category.create({
      data: {
        organizationId: Number(organizationId),
        name: normalizedName,
        code: normalizedCode,
        isActive: toIsActive(status)
      }
    });
    return row;
  } catch (e) {
    if (e?.code === 'P2002') throw new Error('Category code already exists');
    throw e;
  }
}

async function updateCategory({ organizationId, categoryId, patch }) {
  const data = {};
  if (patch.name !== undefined) data.name = normalizeName(patch.name);
  if (patch.code !== undefined) data.code = normalizeCode(patch.code);
  if (patch.status !== undefined) data.isActive = toIsActive(patch.status);

  const res = await prisma.category.updateMany({
    where: notDeleted({ id: Number(categoryId), organizationId: Number(organizationId) }),
    data
  });
  if (!res.count) throw new Error('Category not found');

  const row = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
  return row;
}

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory
};
