const { z } = require('zod');
const service = require('./suppliers.service');

const fields = {
  supplierCode: z.string().trim().min(1).max(100),
  supplierName: z.string().trim().min(1).max(255),
  contactPerson: z.string().trim().max(255).optional(),
  address: z.string().trim().max(2000).optional(),
  email: z.string().trim().max(255).optional(),
  phoneNumber: z.string().trim().max(100).optional(),
  status: z.enum(['Active', 'Inactive']).optional()
};

const createSchema = z.object({
  supplierCode: fields.supplierCode,
  supplierName: fields.supplierName,
  contactPerson: fields.contactPerson,
  address: fields.address,
  email: fields.email,
  phoneNumber: fields.phoneNumber,
  status: fields.status
});

const updateSchema = z.object({
  supplierCode: fields.supplierCode.optional(),
  supplierName: fields.supplierName.optional(),
  contactPerson: fields.contactPerson,
  address: fields.address,
  email: fields.email,
  phoneNumber: fields.phoneNumber,
  status: fields.status
});

function sendError(res, error) {
  const message = error?.message || 'Unable to process supplier request';
  const status = message === 'Supplier not found' ? 404 : 400;
  return res.error(message, status);
}

async function getAllSuppliers(req, res) {
  try {
    const data = await service.getAllSuppliers({ organizationId: req.organization.id });
    return res.success(data);
  } catch (error) {
    return res.error('Unable to load suppliers', 500);
  }
}

async function createSupplier(req, res) {
  try {
    const input = createSchema.parse(req.body);
    const data = await service.createSupplier({
      organizationId: req.organization.id,
      input
    });
    return res.success(data, 'Supplier created successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateSupplier(req, res) {
  try {
    const input = updateSchema.parse(req.body);
    const data = await service.updateSupplier({
      organizationId: req.organization.id,
      supplierId: req.params.id,
      input
    });
    return res.success(data, 'Supplier updated successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getAllSuppliers, createSupplier, updateSupplier };
