const { z } = require('zod');
const templatesService = require('./templates.service');

const backgroundModeSchema = z.enum(['background', 'fit', 'actual']);
const templateTypeSchema = z.enum(['auth', 'supporting']);

const createSchema = z.object({
  certificateId: z.string().trim().min(1),
  templateType: templateTypeSchema.optional(),
  name: z.string().trim().min(1),
  background: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundMode: backgroundModeSchema.optional(),
  layoutJson: z.any().optional(),
  placeholders: z.any().optional(),
  canvasWidth: z.number().int().optional(),
  canvasHeight: z.number().int().optional()
});

const updateSchema = z.object({
  certificateId: z.string().trim().min(1).optional(),
  templateType: templateTypeSchema.optional(),
  name: z.string().trim().min(1).optional(),
  background: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundMode: backgroundModeSchema.optional(),
  layoutJson: z.any().optional(),
  placeholders: z.any().optional(),
  canvasWidth: z.number().int().optional(),
  canvasHeight: z.number().int().optional()
});

async function list(req, res) {
  try {
    const typeRaw = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const type = typeRaw ? templateTypeSchema.safeParse(typeRaw).data : undefined;
    const templates = await templatesService.listTemplates({ organizationId: req.organization.id, templateType: type });
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
      certificateId: data.certificateId,
      templateType: data.templateType,
      name: data.name,
      background: data.background,
      backgroundColor: data.backgroundColor,
      backgroundMode: data.backgroundMode,
      layoutJson: data.layoutJson,
      placeholders: data.placeholders,
      canvasWidth: data.canvasWidth,
      canvasHeight: data.canvasHeight
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
