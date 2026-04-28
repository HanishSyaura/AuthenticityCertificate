const apiKeyService = require('../services/apiKey.service');

function readApiKey(req) {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('apikey ')) return auth.slice(7).trim();
  if (typeof req.query?.api_key === 'string' && req.query.api_key.trim()) return req.query.api_key.trim();
  return null;
}

async function requireApiKey(req, res, next) {
  const raw = readApiKey(req);
  if (!raw) return res.error('API key required', 401);
  const found = await apiKeyService.findApiKey(raw);
  if (!found) return res.error('Invalid API key', 401);

  const rl = apiKeyService.checkRateLimit(found);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec || 60));
    return res.error('Rate limit exceeded', 429);
  }

  req.apiKey = found;
  if (!req.organization?.id && found.organizationId) {
    req.organization = { id: found.organizationId, code: null, name: null };
  }

  next();
}

module.exports = {
  requireApiKey
};

