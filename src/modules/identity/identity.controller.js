const identityService = require('../../services/identity.service');

function parseLimit(req) {
  const limit = Number(req.query.limit || 50);
  return Math.max(1, Math.min(200, limit));
}

function parseOffset(req) {
  const offset = Number(req.query.offset || 0);
  return Math.max(0, offset);
}

async function list(req, res) {
  try {
    const limit = parseLimit(req);
    const offset = parseOffset(req);
    const q = req.query.q ? String(req.query.q) : null;
    const certificateId = req.query.certificateId ? String(req.query.certificateId) : null;
    const nfcUid = req.query.nfcUid ? String(req.query.nfcUid) : null;
    const epc = req.query.epc ? String(req.query.epc) : null;
    const active = req.query.active == null ? true : String(req.query.active) !== 'false';

    const result = await identityService.listIdentities({
      organizationId: req.organization.id,
      q,
      certificateId,
      nfcUid,
      epc,
      active,
      limit,
      offset
    });

    res.success(result);
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function unassign(req, res) {
  try {
    const { id } = req.params;
    const result = await identityService.unassignIdentity({ organizationId: req.organization.id, id });
    res.success(result, 'Unassigned');
  } catch (e) {
    res.error(e.message, 400);
  }
}

module.exports = {
  list,
  unassign
};

