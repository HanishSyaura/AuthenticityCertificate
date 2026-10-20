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

function parseNumericFontSize(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractRichTextPresentation(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { fontSize: null, align: null };

  if (typeof window !== 'undefined' && typeof window.DOMParser === 'function') {
    try {
      const doc = new window.DOMParser().parseFromString(toQuillHtml(raw), 'text/html');
      const styledNode =
        doc.body.querySelector('[style*="font-size"]') ||
        doc.body.querySelector('[class*="ql-size-"]') ||
        doc.body.firstElementChild;
      const alignedNode =
        doc.body.querySelector('.ql-align-center, .ql-align-right, .ql-align-justify, [style*="text-align"]') ||
        doc.body.firstElementChild;

      let fontSize = null;
      let align = null;

      if (styledNode) {
        fontSize =
          parseNumericFontSize(styledNode.style?.fontSize) ||
          parseNumericFontSize(styledNode.getAttribute?.('style')) ||
          parseNumericFontSize(styledNode.className);
      }

      if (alignedNode) {
        if (alignedNode.classList?.contains('ql-align-center')) align = 'center';
        else if (alignedNode.classList?.contains('ql-align-right')) align = 'right';
        else if (alignedNode.classList?.contains('ql-align-justify')) align = 'justify';
        else {
          const textAlign = String(alignedNode.style?.textAlign || '').trim().toLowerCase();
          if (textAlign === 'center' || textAlign === 'right' || textAlign === 'justify' || textAlign === 'left') {
            align = textAlign;
          }
        }
      }

      return { fontSize, align };
    } catch {
      void 0;
    }
  }

  const fontSizeMatch = raw.match(/font-size:\s*(\d+(?:\.\d+)?)(?:px|pt)?/i);
  const alignMatch = raw.match(/ql-align-(center|right|justify)|text-align:\s*(left|center|right|justify)/i);
  return {
    fontSize: fontSizeMatch ? Number(fontSizeMatch[1]) : null,
    align: alignMatch ? String(alignMatch[1] || alignMatch[2] || '').toLowerCase() : null
  };
}

export function applyRichTextPresentation(input, { fontSize, align } = {}) {
  const raw = String(input ?? '').trim();
  const html = toQuillHtml(raw || '<p><br></p>');

  if (typeof window !== 'undefined' && typeof window.DOMParser === 'function') {
    try {
      const doc = new window.DOMParser().parseFromString(html, 'text/html');
      const blocks = Array.from(doc.body.children);
      const targets = blocks.length > 0 ? blocks : [doc.body];

      for (const node of targets) {
        if (fontSize != null && Number.isFinite(Number(fontSize))) {
          node.style.fontSize = `${Number(fontSize)}pt`;
        }
        if (align) {
          node.classList?.remove('ql-align-center', 'ql-align-right', 'ql-align-justify');
          node.style.textAlign = '';
          if (align === 'center' || align === 'right' || align === 'justify') {
            node.classList?.add(`ql-align-${align}`);
          }
        }
      }

      return doc.body.innerHTML;
    } catch {
      return html;
    }
  }

  return html;
}

