const { z } = require('zod');
const fraudService = require('../../services/fraud.service');

const createSchema = z.object({
  certificateId: z.string().min(1),
  reason: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']).optional()
});

async function list(req, res) {
  const status = typeof req.query.status === 'string' ? req.query.status : 'open';
  const limit = Number(req.query.limit || 200);
  const offset = Number(req.query.offset || 0);
  const result = await fraudService.listFlags({
    organizationId: req.organization.id,
    status,
    limit,
    offset
  });
  res.success(result);
}

async function create(req, res) {
  try {
    const data = createSchema.parse(req.body);
    const flag = await fraudService.createFlag({
      organizationId: req.organization.id,
      certificateId: data.certificateId,
      reason: data.reason,
      severity: data.severity || 'medium'
    });
    res.success(flag, 'Flag created');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function resolve(req, res) {
  try {
    const id = req.params.id;
    const updated = await fraudService.resolveFlag({
      organizationId: req.organization.id,
      id,
      userId: typeof req.user?.id === 'number' ? req.user.id : null
    });
    res.success(updated, 'Flag resolved');
  } catch (e) {
    res.error(e.message, 400);
  }
}

module.exports = {
  list,
  create,
  resolve
};

