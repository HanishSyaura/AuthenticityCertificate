function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeTextToHtml(input) {
  return escapeHtml(input).replace(/\r?\n/g, '<br/>');
}

function sanitizeStyle(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/url\s*\(|expression\s*\(|javascript:/i.test(raw)) return '';
  const allowed = new Set([
    'color',
    'background-color',
    'font-weight',
    'font-style',
    'text-decoration',
    'text-align',
    'font-size',
    'font-family',
    'line-height',
    'border',
    'border-color',
    'border-width',
    'border-style',
    'border-collapse',
    'padding',
    'padding-left',
    'padding-right',
    'padding-top',
    'padding-bottom',
    'margin',
    'margin-left',
    'margin-right',
    'margin-top',
    'margin-bottom',
    'width',
    'height',
    'max-width',
    'min-width'
  ]);
  const parts = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = [];
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (!allowed.has(prop)) continue;
    if (!val) continue;
    if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) continue;
    kept.push(`${prop}: ${val}`);
  }
  return kept.join('; ');
}

function sanitizeUrl(input, { allowDataImage = false } = {}) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('?')) return raw;
  const lower = raw.toLowerCase();
  if (lower.startsWith('mailto:') || lower.startsWith('tel:')) return raw;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return raw;
  if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
  return '';
}

function sanitizeClass(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const allowed = new Set([
    'ql-ui',
    'ql-formula',
    'ql-video',
    'ql-align-left',
    'ql-align-center',
    'ql-align-right',
    'ql-align-justify',
    'ql-direction-rtl',
    'ql-size-small',
    'ql-size-large',
    'ql-size-huge',
    'ql-font-serif',
    'ql-font-monospace'
  ]);
  const kept = raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((c) => allowed.has(c) || /^ql-indent-[1-8]$/.test(c) || /^ql-font-[a-z0-9-]{1,30}$/i.test(c));
  return kept.join(' ');
}

function sanitizeDir(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw === 'rtl' || raw === 'ltr') return raw;
  return '';
}

function sanitizeDataList(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw === 'checked' || raw === 'unchecked' || raw === 'ordered' || raw === 'bullet') return raw;
  return '';
}

function sanitizeDataValue(input) {
  const raw = String(input || '');
  if (!raw) return '';
  return raw.length > 5000 ? raw.slice(0, 5000) : raw;
}

export function sanitizeLimitedHtml(input) {
  const raw = String(input ?? '');
  if (!raw) return '';
  if (typeof window === 'undefined' || typeof window.DOMParser !== 'function') return escapeTextToHtml(raw);
  const allowed = new Set([
    'BR',
    'B',
    'STRONG',
    'I',
    'EM',
    'U',
    'S',
    'STRIKE',
    'SUB',
    'SUP',
    'DIV',
    'P',
    'SPAN',
    'H1',
    'H2',
    'H3',
    'BLOCKQUOTE',
    'UL',
    'OL',
    'LI',
    'A',
    'FONT',
    'TABLE',
    'THEAD',
    'TBODY',
    'TR',
    'TD',
    'TH',
    'IMG',
    'IFRAME'
  ]);
  let doc;
  try {
    doc = new window.DOMParser().parseFromString(String(raw), 'text/html');
  } catch {
    return escapeTextToHtml(raw);
  }
  const allowedAttrs = {
    DIV: new Set(['style', 'class']),
    P: new Set(['style', 'class']),
    SPAN: new Set(['style', 'class']),
    UL: new Set(['style', 'class']),
    OL: new Set(['style', 'class']),
    LI: new Set(['style', 'class']),
    B: new Set(['style']),
    STRONG: new Set(['style']),
    I: new Set(['style']),
    EM: new Set(['style']),
    U: new Set(['style']),
    S: new Set(['style']),
    STRIKE: new Set(['style']),
    SUP: new Set(['style']),
    BR: new Set([])
  };
  const walk = (node) => {
    const kids = Array.from(node.childNodes || []);
    for (const child of kids) {
      if (child.nodeType === 1) {
        const tag = String(child.tagName || '').toUpperCase();
        if (tag === 'SCRIPT' || tag === 'STYLE') {
          child.remove();
          continue;
        }
        if (!allowed.has(tag)) {
          const frag = doc.createDocumentFragment();
          while (child.firstChild) frag.appendChild(child.firstChild);
          child.replaceWith(frag);
          continue;
        }
        const keep = allowedAttrs[tag] || new Set([]);
        const attrs = Array.from(child.attributes || []);
        for (const a of attrs) {
          const name = String(a.name || '').toLowerCase();
          if (!keep.has(name)) {
            child.removeAttribute(a.name);
            continue;
          }
          if (name === 'class') {
            const safe = sanitizeClass(a.value);
            if (safe) child.setAttribute('class', safe);
            else child.removeAttribute('class');
            continue;
          }
          if (name === 'style') {
            const safe = sanitizeStyle(a.value);
            if (safe) child.setAttribute('style', safe);
            else child.removeAttribute('style');
            continue;
          }
        }
        walk(child);
      } else if (child.nodeType === 8) {
        child.remove();
      } else if (child.nodeType === 3) {
        continue;
      } else {
        walk(child);
      }
    }
  };
  walk(doc.body);
  return String(doc.body.innerHTML || '');
}

