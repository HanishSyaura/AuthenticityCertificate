export function buildUploadsWebpSrcSet(url, widths = [320, 640, 1024]) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const markers = ['/public/uploads/', '/uploads/'];
  let uploadsIdx = -1;
  for (const m of markers) {
    const idx = raw.indexOf(m);
    if (idx >= 0) {
      uploadsIdx = idx;
      break;
    }
  }
  if (uploadsIdx < 0) return null;

  const prefix = raw.slice(0, uploadsIdx);
  const rest = raw.slice(uploadsIdx);
  const hashIdx = rest.indexOf('#');
  const restNoHash = hashIdx >= 0 ? rest.slice(0, hashIdx) : rest;
  const qIdx = restNoHash.indexOf('?');
  const pathPart = qIdx >= 0 ? restNoHash.slice(0, qIdx) : restNoHash;
  const query = qIdx >= 0 ? restNoHash.slice(qIdx) : '';

  const lastSlash = pathPart.lastIndexOf('/');
  if (lastSlash < 0) return null;
  const dir = pathPart.slice(0, lastSlash + 1);
  const file = pathPart.slice(lastSlash + 1);

  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = file.slice(dot + 1).toLowerCase();
  const allowed = new Set(['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'avif']);
  if (!allowed.has(ext)) return null;
  const base = file.slice(0, dot);
  if (!base || !/^[A-Za-z0-9_-]+$/.test(base)) return null;

  const safeWidths = (Array.isArray(widths) ? widths : [])
    .map((w) => Number(w))
    .filter((w) => Number.isFinite(w) && w > 0);
  if (safeWidths.length === 0) return null;

  return safeWidths.map((w) => `${prefix}${dir}${base}-w${w}.webp${query} ${w}w`).join(', ');
}

