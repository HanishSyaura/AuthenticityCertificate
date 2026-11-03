const { z } = require('zod');
const service = require('./customers.service');

const fields = {
  customerCode: z.string().trim().min(1).max(100),
  customerName: z.string().trim().min(1).max(255),
  contactPerson: z.string().trim().max(255).optional(),
  contactNo: z.string().trim().max(100).optional(),
  address: z.string().trim().max(2000).optional(),
  email: z.string().trim().max(255).optional(),
  status: z.enum(['Active', 'Inactive']).optional()
};

const createSchema = z.object({
  customerCode: fields.customerCode,
  customerName: fields.customerName,
  contactPerson: fields.contactPerson,
  contactNo: fields.contactNo,
  address: fields.address,
  email: fields.email,
  status: fields.status
});

const updateSchema = z.object({
  customerCode: fields.customerCode.optional(),
  customerName: fields.customerName.optional(),
  contactPerson: fields.contactPerson,
  contactNo: fields.contactNo,
  address: fields.address,
  email: fields.email,
  status: fields.status
});

function sendError(res, error) {
  const message = error?.message || 'Unable to process customer request';
  const status = message === 'Customer not found' ? 404 : 400;
  return res.error(message, status);
}

async function getAllCustomers(req, res) {
  try {
    const data = await service.getAllCustomers({ organizationId: req.organization.id });
    return res.success(data);
  } catch (error) {
    return res.error('Unable to load customers', 500);
  }
}

async function createCustomer(req, res) {
  try {
    const input = createSchema.parse(req.body);
    const data = await service.createCustomer({
      organizationId: req.organization.id,
      input
    });
    return res.success(data, 'Customer created successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateCustomer(req, res) {
  try {
    const input = updateSchema.parse(req.body);
    const data = await service.updateCustomer({
      organizationId: req.organization.id,
      customerId: req.params.id,
      input
    });
    return res.success(data, 'Customer updated successfully');
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = { getAllCustomers, createCustomer, updateCustomer };
