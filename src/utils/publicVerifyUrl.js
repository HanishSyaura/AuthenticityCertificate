function firstHeaderValue(value) {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '')
    .split(',')[0]
    .trim();
}

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

function resolveRequestOrigin(req) {
  const forwardedProto = firstHeaderValue(req?.headers?.['x-forwarded-proto']);
  const forwardedHost = firstHeaderValue(req?.headers?.['x-forwarded-host']);
  if (forwardedProto && forwardedHost) {
    const forwardedOrigin = normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  const originHeader = normalizeOrigin(firstHeaderValue(req?.headers?.origin));
  if (originHeader) return originHeader;

  const referer = String(firstHeaderValue(req?.headers?.referer) || '').trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (refererOrigin) return refererOrigin;
    } catch {}
  }

  const host = firstHeaderValue(req?.headers?.host);
  if (host) {
    const protocol =
      forwardedProto ||
      (String(req?.protocol || '').trim() ? String(req.protocol).trim() : req?.socket?.encrypted ? 'https' : 'http');
    const hostOrigin = normalizeOrigin(`${protocol}://${host}`);
    if (hostOrigin) return hostOrigin;
  }

  return '';
}

function resolvePublicVerifyUrlPrefix(req) {
  const configuredPrefix = String(process.env.PUBLIC_VERIFY_URL_PREFIX || '').trim();
  if (configuredPrefix) return configuredPrefix;

  const requestOrigin = resolveRequestOrigin(req);
  if (requestOrigin) return `${requestOrigin}/verify?epc=`;

  return 'https://wmscertauth.clbgroups.com/verify?epc=';
}

module.exports = {
  resolvePublicVerifyUrlPrefix,
  resolveRequestOrigin
};
