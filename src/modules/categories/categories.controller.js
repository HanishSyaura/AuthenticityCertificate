const categoriesService = require('./categories.service');
const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  status: z.enum(['active', 'inactive']).optional()
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional()
});

async function getAllCategories(req, res) {
  try {
    const categories = await categoriesService.getAllCategories({ organizationId: req.organization.id });
    res.success(categories);
  } catch (error) {
    res.error(error.message);
  }
}

async function createCategory(req, res) {
  try {
    const validated = createCategorySchema.parse(req.body);
    const category = await categoriesService.createCategory({
      organizationId: req.organization.id,
      name: validated.name,
      code: validated.code,
      status: validated.status
    });
    res.success(category, 'Category created successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const validated = updateCategorySchema.parse(req.body);
    const category = await categoriesService.updateCategory({
      organizationId: req.organization.id,
      categoryId: id,
      patch: validated
    });
    res.success(category, 'Category updated successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory
};
