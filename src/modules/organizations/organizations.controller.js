const { z } = require('zod');
const orgService = require('./organizations.service');

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(2).max(20)
});

async function list(req, res) {
  try {
    const orgs = await orgService.listOrganizations();
    res.success(orgs);
  } catch (e) {
    res.error(e.message);
  }
}

async function create(req, res) {
  try {
    const data = createSchema.parse(req.body);
    const org = await orgService.createOrganization({ name: data.name, code: data.code.toUpperCase() });
    res.success(org, 'Organization created');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function me(req, res) {
  res.success({ organization: req.organization || null });
}

module.exports = {
  list,
  create,
  me
};

