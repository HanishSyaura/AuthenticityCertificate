export function hasPermission(permissions, required) {
  if (!required) return true;
  const owned = Array.isArray(permissions) ? permissions : [];
  if (owned.includes('*')) return true;
  if (owned.includes(required)) return true;
  return owned.some((p) => typeof p === 'string' && p.endsWith('.*') && String(required).startsWith(p.slice(0, -1)));
}

