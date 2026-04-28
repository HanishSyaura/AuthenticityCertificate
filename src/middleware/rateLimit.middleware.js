function makeKey(parts) {
  return parts.filter(Boolean).join('|');
}

function normalizeIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimit({ windowMs, max, keyFn, message }) {
  const hits = new Map();
  let ops = 0;

  const w = Math.max(1000, Number(windowMs) || 60_000);
  const m = Math.max(1, Number(max) || 60);

  return (req, res, next) => {
    const now = Date.now();
    const ip = normalizeIp(req);
    const key = (typeof keyFn === 'function' ? keyFn(req) : null) || makeKey([ip, req.path]);
    const item = hits.get(key);

    ops++;
    if (ops % 1000 === 0) {
      for (const [k, v] of hits.entries()) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }

    if (!item || item.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + w });
      return next();
    }

    item.count += 1;
    if (item.count > m) {
      const retryAfter = Math.ceil((item.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.error(message || 'Too many requests', 429);
    }

    next();
  };
}

module.exports = {
  rateLimit
};
