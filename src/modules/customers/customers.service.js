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

function normalizeCustomer(input) {
  const data = {};
  if (input.customerCode !== undefined) data.customerCode = normalizeCode(input.customerCode);
  if (input.customerName !== undefined) data.customerName = String(input.customerName || '').trim();
  for (const key of ['contactPerson', 'contactNo', 'address', 'email']) {
    if (input[key] !== undefined) data[key] = optionalText(input[key]);
  }
  if (input.status !== undefined) data.status = normalizeStatus(input.status);
  return data;
}

async function getAllCustomers({ organizationId }) {
  return prisma.customer.findMany({
    where: { organizationId: Number(organizationId), deletedAt: null },
    orderBy: [{ customerName: 'asc' }, { customerCode: 'asc' }]
  });
}

async function createCustomer({ organizationId, input }) {
  const data = normalizeCustomer(input);
  if (!data.customerCode) throw new Error('Customer code is required');
  if (!data.customerName) throw new Error('Customer name is required');

  try {
    return await prisma.customer.create({
      data: {
        organizationId: Number(organizationId),
        customerCode: data.customerCode,
        customerName: data.customerName,
        contactPerson: data.contactPerson ?? null,
        contactNo: data.contactNo ?? null,
        address: data.address ?? null,
        email: data.email ?? null,
        status: data.status || 'Active'
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new Error('Customer code already exists');
    throw error;
  }
}

async function updateCustomer({ organizationId, customerId, input }) {
  const id = Number(customerId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid customer ID');

  const data = normalizeCustomer(input);
  if (Object.keys(data).length === 0) throw new Error('No valid fields supplied');
  if (data.customerCode !== undefined && !data.customerCode) throw new Error('Customer code is required');
  if (data.customerName !== undefined && !data.customerName) throw new Error('Customer name is required');

  try {
    const result = await prisma.customer.updateMany({
      where: {
        id,
        organizationId: Number(organizationId),
        deletedAt: null
      },
      data
    });
    if (!result.count) throw new Error('Customer not found');

    return await prisma.customer.findFirst({
      where: { id, organizationId: Number(organizationId), deletedAt: null }
    });
  } catch (error) {
    if (error?.code === 'P2002') throw new Error('Customer code already exists');
    throw error;
  }
}

module.exports = { getAllCustomers, createCustomer, updateCustomer };
