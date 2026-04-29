const orgService = require('../modules/organizations/organizations.service');

async function attachOrganization(req, res, next) {
  if (req.organization?.id) return next();
  try {
    const org = await orgService.getOrCreateDefault();
    if (org && !org.deletedAt) req.organization = org;
  } catch {
  }
  next();
}

function requireOrganization(req, res, next) {
  if (!req.organization?.id) return res.error('Organization required', 400);
  next();
}

module.exports = {
  attachOrganization,
  requireOrganization
};
