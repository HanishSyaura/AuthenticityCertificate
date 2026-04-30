const productService = require('./product.service');
const { z } = require('zod');

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  product_code: z.string().min(1),
  category: z.string().min(1),
  status: z.string().min(1),
  remark: z.string().optional()
});

function formatZodMessage(error) {
  const issue = Array.isArray(error?.issues) ? error.issues[0] : null;
  if (!issue) return 'Invalid request';
  const path = Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : 'field';
  return `${path}: ${issue.message}`;
}

function formatUniqueMessage(error) {
  const target = error?.meta?.target;
  const fields = Array.isArray(target) ? target.map((v) => String(v)) : [];
  if (fields.includes('sku')) return 'SKU already exists';
  if (fields.includes('code')) return 'Product code already exists';
  return 'Duplicate value';
}

function sendProductError(res, error) {
  if (error instanceof z.ZodError) return res.error(formatZodMessage(error), 400);
  if (error?.code === 'P2002') return res.error(formatUniqueMessage(error), 409);
  if (error?.message === 'db_timeout') return res.error('Database timeout', 503);
  return res.error(error?.message || 'Failed to process request', 400);
}

const updateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  product_code: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  remark: z.string().nullable().optional(),
  cmsPageId: z.number().int().nullable().optional(),
  cmsCertificatePageId: z.number().int().nullable().optional(),
  certificateTemplateId: z.number().int().nullable().optional()
});

const batchSchema = z.object({
  batchNo: z.string().min(1),
  productId: z.number().int()
});

async function createProduct(req, res) {
  try {
    const validatedData = productSchema.parse(req.body);
    const product = await productService.createProduct({
      organizationId: req.organization.id,
      ...validatedData
    });
    res.success(product, 'Product created successfully');
  } catch (error) {
    sendProductError(res, error);
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const validatedData = updateProductSchema.parse(req.body);
    const product = await productService.updateProduct({
      organizationId: req.organization.id,
      productId: id,
      patch: validatedData
    });
    res.success(product, 'Product updated successfully');
  } catch (error) {
    sendProductError(res, error);
  }
}

async function deactivateProduct(req, res) {
  try {
    const { id } = req.params;
    const product = await productService.deactivateProduct({
      organizationId: req.organization.id,
      productId: id
    });
    res.success(product, 'Product deactivated successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function getAllProducts(req, res) {
  try {
    const includeDeleted = String(req.query?.includeDeleted || '').toLowerCase() === 'true';
    const products = await productService.getAllProducts({ organizationId: req.organization.id, includeDeleted });
    res.success(products);
  } catch (error) {
    res.error(error.message);
  }
}

async function createBatch(req, res) {
  try {
    const validatedData = batchSchema.parse(req.body);
    const batch = await productService.createBatch({
      organizationId: req.organization.id,
      ...validatedData
    });
    res.success(batch, 'Batch created successfully');
  } catch (error) {
    sendProductError(res, error);
  }
}

async function getProductBatches(req, res) {
  try {
    const { id } = req.params;
    const batches = await productService.getBatchesByProduct({ organizationId: req.organization.id, productId: id });
    res.success(batches);
  } catch (error) {
    res.error(error.message);
  }
}

module.exports = {
  createProduct,
  updateProduct,
  deactivateProduct,
  getAllProducts,
  createBatch,
  getProductBatches
};
