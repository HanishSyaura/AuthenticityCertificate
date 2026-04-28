const orgService = require('../modules/organizations/organizations.service');

function readOrgCode(req) {
  const raw = req.headers['x-org-code'] || req.headers['x-organization-code'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

async function attachOrganization(req, res, next) {
  if (req.organization?.id) return next();
  const headerCode = readOrgCode(req);
  const fallbackCode = req.user?.organizationCode || null;
  const code = headerCode || fallbackCode || null;
  if (!code) return next();
  try {
    const org = await orgService.getByCode(code);
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
