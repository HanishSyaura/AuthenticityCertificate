const orgService = require('../modules/organizations/organizations.service');

async function resolveOrganization(req) {
  if (req.organization?.id) return req.organization;
  try {
    const userOrgId = Number(req.user?.organizationId || 0);
    if (Number.isInteger(userOrgId) && userOrgId > 0) {
      const userOrg = await orgService.getById(userOrgId);
      if (userOrg) {
        req.organization = userOrg;
        return req.organization;
      }
    }
    const org = await orgService.getOrCreateDefault();
    if (org) {
      req.organization = org;
      if (req.user && (!Number.isInteger(Number(req.user.organizationId)) || Number(req.user.organizationId) <= 0)) {
        req.user.organizationId = org.id;
      }
    }
  } catch {
  }
  return req.organization || null;
}

async function attachOrganization(req, res, next) {
  await resolveOrganization(req);
  next();
}

async function requireOrganization(req, res, next) {
  const org = await resolveOrganization(req);
  if (!org?.id) return res.error('Service temporarily unavailable', 503);
  next();
}

module.exports = {
  resolveOrganization,
  attachOrganization,
  requireOrganization
};
