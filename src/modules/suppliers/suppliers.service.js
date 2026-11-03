const prisma = require('../../config/prisma');

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeStatus(value) {
  const status = String(value || 'Active').trim().toLowerCase();
  if (status === 'active') return 'Active';
  if (status === 'inactive') return 'Inactive';
  throw new Error('Status must be Active or Inactive');
}

function optionalText(value) {
  const result = clean(value);
  return result === '' ? null : result ?? null;
}

function normalizeSupplier(input) {
  const data = {};
  if (input.supplierCode !== undefined) data.supplierCode = normalizeCode(input.supplierCode);
  if (input.supplierName !== undefined) data.supplierName = String(input.supplierName || '').trim();
  for (const key of ['contactPerson', 'address', 'email', 'phoneNumber']) {
    if (input[key] !== undefined) data[key] = optionalText(input[key]);
  }
  if (input.status !== undefined) data.status = normalizeStatus(input.status);
  return data;
}

async function getAllSuppliers({ organizationId }) {
  return prisma.supplier.findMany({
    where: { organizationId: Number(organizationId), deletedAt: null },
    orderBy: [{ supplierName: 'asc' }, { supplierCode: 'asc' }]
  });
}

async function createSupplier({ organizationId, input }) {
  const data = normalizeSupplier(input);
  if (!data.supplierCode) throw new Error('Supplier code is required');
  if (!data.supplierName) throw new Error('Supplier name is required');

  try {
    return await prisma.supplier.create({
      data: {
        organizationId: Number(organizationId),
        supplierCode: data.supplierCode,
        supplierName: data.supplierName,
        contactPerson: data.contactPerson ?? null,
        address: data.address ?? null,
        email: data.email ?? null,
        phoneNumber: data.phoneNumber ?? null,
        status: data.status || 'Active'
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new Error('Supplier code already exists');
    throw error;
  }
}

async function updateSupplier({ organizationId, supplierId, input }) {
  const id = Number(supplierId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid supplier ID');

  const data = normalizeSupplier(input);
  if (Object.keys(data).length === 0) throw new Error('No valid fields supplied');
  if (data.supplierCode !== undefined && !data.supplierCode) throw new Error('Supplier code is required');
  if (data.supplierName !== undefined && !data.supplierName) throw new Error('Supplier name is required');

  try {
    const result = await prisma.supplier.updateMany({
      where: {
        id,
        organizationId: Number(organizationId),
        deletedAt: null
      },
      data
    });
    if (!result.count) throw new Error('Supplier not found');

    return await prisma.supplier.findFirst({
      where: { id, organizationId: Number(organizationId), deletedAt: null }
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new Error('Supplier code already exists');
    throw error;
  }
}

module.exports = { getAllSuppliers, createSupplier, updateSupplier };
