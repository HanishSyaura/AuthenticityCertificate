function isSafeRelativeUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return false;
  if (/^\s*javascript:/i.test(v)) return false;
  if (/^\s*data:/i.test(v)) return false;
  if (/^\s*vbscript:/i.test(v)) return false;
  return true;
}

function firstNumericPathSegment(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.find((p) => /^\d+$/.test(p)) || null;
}

function resolveYoutubeEmbed(urlObj) {
  const host = String(urlObj.hostname || '').toLowerCase();
  if (host === 'youtu.be') {
    const id = String(urlObj.pathname || '').split('/').filter(Boolean)[0] || '';
    if (!id) return null;
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
  }

  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com' || host === 'www.youtube-nocookie.com') {
    const path = String(urlObj.pathname || '');
    if (path === '/watch') {
      const v = urlObj.searchParams.get('v');
      if (!v) return null;
      return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
    }
    if (path.startsWith('/shorts/')) {
      const id = path.split('/').filter(Boolean)[1] || '';
      if (!id) return null;
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
    if (path.startsWith('/embed/')) {
      const id = path.split('/').filter(Boolean)[1] || '';
      if (!id) return null;
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
  }

  return null;
}

function resolveVimeoEmbed(urlObj) {
  const host = String(urlObj.hostname || '').toLowerCase();
  const path = String(urlObj.pathname || '');
  if (host === 'player.vimeo.com') {
    const parts = path.split('/').filter(Boolean);
    const idx = parts.indexOf('video');
    const id = idx >= 0 ? parts[idx + 1] : null;
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    return null;
  }

  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const id = firstNumericPathSegment(path);
    if (!id) return null;
    return `https://player.vimeo.com/video/${id}`;
  }

  return null;
}

export function resolveCmsVideoSource(input, baseOrigin = 'https://example.invalid') {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!isSafeRelativeUrl(raw)) return null;
    return { kind: 'video', src: raw };
  }

  let urlObj;
  try {
    urlObj = new URL(raw, baseOrigin);
  } catch {
    return null;
  }

  const protocol = String(urlObj.protocol || '').toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') return null;

  const yt = resolveYoutubeEmbed(urlObj);
  if (yt) return { kind: 'iframe', src: yt };

  const vimeo = resolveVimeoEmbed(urlObj);
  if (vimeo) return { kind: 'iframe', src: vimeo };

  return { kind: 'video', src: raw };
}

