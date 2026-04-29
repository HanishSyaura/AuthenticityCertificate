const { z } = require('zod');
const templatesService = require('./templates.service');

const createSchema = z.object({
  name: z.string().min(1),
  background: z.string().optional(),
  layoutJson: z.any().optional()
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  background: z.string().optional(),
  layoutJson: z.any().optional()
});

async function list(req, res) {
  try {
    const templates = await templatesService.listTemplates({ organizationId: req.organization.id });
    res.success(templates);
  } catch (e) {
    res.error(e.message);
  }
}

async function create(req, res) {
  try {
    const data = createSchema.parse(req.body);
    const created = await templatesService.createTemplate({
      organizationId: req.organization.id,
      name: data.name,
      background: data.background,
      layoutJson: data.layoutJson
    });
    res.success(created, 'Template created');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const data = updateSchema.parse(req.body);
    const updated = await templatesService.updateTemplate({ organizationId: req.organization.id, id, patch: data });
    res.success(updated, 'Template updated');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await templatesService.deleteTemplate({ organizationId: req.organization.id, id });
    res.success(result, 'Template deleted');
  } catch (e) {
    res.error(e.message, 400);
  }
}

module.exports = {
  list,
  create,
  update,
  remove
};

