const productService = require('./product.service');
const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1)
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
    res.error(error.message, 400);
  }
}

async function getAllProducts(req, res) {
  try {
    const products = await productService.getAllProducts({ organizationId: req.organization.id });
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
    res.error(error.message, 400);
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
  getAllProducts,
  createBatch,
  getProductBatches
};
