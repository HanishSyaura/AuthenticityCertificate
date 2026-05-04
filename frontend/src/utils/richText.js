function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripHtmlToText(input) {
  const raw = String(input ?? '');
  if (!raw) return '';
  if (typeof window !== 'undefined' && typeof window.DOMParser === 'function') {
    try {
      const doc = new window.DOMParser().parseFromString(raw, 'text/html');
      return String(doc.body?.textContent || '');
    } catch {
      return raw.replace(/<[^>]*>/g, '');
    }
  }
  return raw.replace(/<[^>]*>/g, '');
}

export function isRichTextEmpty(input) {
  return !String(stripHtmlToText(input) || '').trim();
}

export function toQuillHtml(input) {
  const raw = String(input ?? '');
  if (!raw.trim()) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (looksLikeHtml) return raw;
  const lines = raw.split(/\r?\n/);
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

