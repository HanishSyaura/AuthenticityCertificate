const cmsService = require('./cms.service');
const { z } = require('zod');

const pageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  kind: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImage: z.string().optional()
});

const layoutSchema = z.object({
  pageId: z.number().int(),
  layoutJson: z.array(z.any()),
  language: z.string().optional()
});

const publishSchema = z.object({
  pageId: z.number().int()
});

const metaSchema = z.object({
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  ogImage: z.string().optional().nullable()
});

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int()).min(1),
  kind: z.string().optional()
});

async function createPage(req, res) {
  try {
    const validatedData = pageSchema.parse(req.body);
    const page = await cmsService.createPage({
      organizationId: req.organization.id,
      ...validatedData
    });
    res.success(page, 'CMS Page created successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function saveLayout(req, res) {
  try {
    const validatedData = layoutSchema.parse(req.body);
    const layout = await cmsService.saveLayout({
      organizationId: req.organization.id,
      pageId: validatedData.pageId,
      layoutJson: validatedData.layoutJson,
      language: validatedData.language
    });
    res.success(layout, 'CMS Layout saved successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function publish(req, res) {
  try {
    const validatedData = publishSchema.parse(req.body);
    const result = await cmsService.publishPage({
      organizationId: req.organization.id,
      pageId: validatedData.pageId
    });
    res.success(result, 'CMS Page published successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function updateMeta(req, res) {
  try {
    const { id } = req.params;
    const validatedData = metaSchema.parse(req.body);
    const updated = await cmsService.updateMeta({
      organizationId: req.organization.id,
      pageId: Number(id),
      ...validatedData
    });
    res.success(updated, 'CMS metadata updated successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function getPage(req, res) {
  try {
    const { slug } = req.params;
    const language = String(req.query.language || req.query.lang || 'en');
    const page = await cmsService.getPageBySlug({ organizationId: req.organization.id, slug, language });
    if (!page) return res.error('Page not found', 404);
    res.success(page);
  } catch (error) {
    res.error(error.message);
  }
}

async function listPages(req, res) {
  try {
    const kind = typeof req.query?.kind === 'string' ? req.query.kind : undefined;
    const pages = await cmsService.getAllPages({ organizationId: req.organization.id, kind });
    res.success(pages);
  } catch (error) {
    res.error(error.message);
  }
}

async function removePage(req, res) {
  try {
    const { id } = req.params;
    const result = await cmsService.deletePage({ organizationId: req.organization.id, pageId: Number(id) });
    res.success(result, 'CMS Page deleted successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

async function reorderPages(req, res) {
  try {
    const validatedData = reorderSchema.parse(req.body);
    const result = await cmsService.reorderPages({
      organizationId: req.organization.id,
      kind: validatedData.kind,
      orderedIds: validatedData.orderedIds
    });
    res.success(result, 'CMS Pages reordered successfully');
  } catch (error) {
    res.error(error.message, 400);
  }
}

module.exports = {
  createPage,
  saveLayout,
  publish,
  updateMeta,
  getPage,
  listPages,
  removePage,
  reorderPages
};
