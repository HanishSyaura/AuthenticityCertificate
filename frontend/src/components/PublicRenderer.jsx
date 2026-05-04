import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/useT';

function getValue(path, data) {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur = data;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return cur ?? '';
}

function normalizeJsonArray(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) return parsed.items;
    } catch {
      return null;
    }
    return null;
  }
  if (input && typeof input === 'object' && Array.isArray(input.items)) return input.items;
  return null;
}

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

function sanitizeLimitedHtml(input) {
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
    'IMG'
  ]);
  let doc;
  try {
    doc = new window.DOMParser().parseFromString(String(raw), 'text/html');
  } catch {
    return escapeTextToHtml(raw);
  }
  const allowedAttrs = {
    A: new Set(['href', 'target', 'rel', 'style']),
    IMG: new Set(['src', 'alt', 'width', 'height', 'style']),
    FONT: new Set(['color', 'face', 'size']),
    TABLE: new Set(['style']),
    THEAD: new Set(['style']),
    TBODY: new Set(['style']),
    TR: new Set(['style']),
    TD: new Set(['colspan', 'rowspan', 'style']),
    TH: new Set(['colspan', 'rowspan', 'style']),
    DIV: new Set(['style']),
    P: new Set(['style']),
    SPAN: new Set(['style']),
    H1: new Set(['style']),
    H2: new Set(['style']),
    H3: new Set(['style']),
    BLOCKQUOTE: new Set(['style']),
    UL: new Set(['style']),
    OL: new Set(['style']),
    LI: new Set(['style']),
    B: new Set(['style']),
    STRONG: new Set(['style']),
    I: new Set(['style']),
    EM: new Set(['style']),
    U: new Set(['style']),
    S: new Set(['style']),
    STRIKE: new Set(['style']),
    SUB: new Set(['style']),
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
          if (name === 'style') {
            const safe = sanitizeStyle(a.value);
            if (safe) child.setAttribute('style', safe);
            else child.removeAttribute('style');
            continue;
          }
          if (tag === 'A' && name === 'href') {
            const safe = sanitizeUrl(a.value);
            if (safe) child.setAttribute('href', safe);
            else child.removeAttribute('href');
            continue;
          }
          if (tag === 'A' && name === 'target') {
            const v = String(a.value || '').toLowerCase();
            if (v === '_blank' || v === '_self') child.setAttribute('target', v);
            else child.removeAttribute('target');
            continue;
          }
          if (tag === 'A' && name === 'rel') {
            const v = String(a.value || '').toLowerCase();
            const next = v.includes('noopener') ? v : `${v} noopener`.trim();
            child.setAttribute('rel', next.includes('noreferrer') ? next : `${next} noreferrer`.trim());
            continue;
          }
          if (tag === 'IMG' && name === 'src') {
            const safe = sanitizeUrl(a.value, { allowDataImage: true });
            if (safe) child.setAttribute('src', safe);
            else child.removeAttribute('src');
            continue;
          }
          if ((tag === 'TD' || tag === 'TH') && (name === 'colspan' || name === 'rowspan')) {
            const n = Math.max(1, Math.min(50, Number(a.value) || 1));
            child.setAttribute(name, String(n));
            continue;
          }
          if (tag === 'FONT' && name === 'size') {
            const n = Math.max(1, Math.min(7, Number(a.value) || 3));
            child.setAttribute('size', String(n));
            continue;
          }
          if (tag === 'FONT' && name === 'color') {
            const v = String(a.value || '').trim();
            if (/^#[0-9a-f]{3,8}$/i.test(v) || /^rgb\(/i.test(v) || /^hsl\(/i.test(v)) child.setAttribute('color', v);
            else child.removeAttribute('color');
            continue;
          }
          if (tag === 'FONT' && name === 'face') {
            const v = String(a.value || '').trim();
            if (v) child.setAttribute('face', v.slice(0, 100));
            else child.removeAttribute('face');
            continue;
          }
          if (tag === 'IMG' && (name === 'width' || name === 'height')) {
            const n = Math.max(1, Math.min(2000, Number(a.value) || 0));
            if (n) child.setAttribute(name, String(n));
            else child.removeAttribute(name);
            continue;
          }
          if (tag === 'IMG' && name === 'alt') {
            child.setAttribute('alt', String(a.value || '').slice(0, 200));
            continue;
          }
        }
        if (tag === 'A') {
          const target = String(child.getAttribute('target') || '').toLowerCase();
          if (target === '_blank') {
            const rel = String(child.getAttribute('rel') || '').toLowerCase();
            const withNoopener = rel.includes('noopener') ? rel : `${rel} noopener`.trim();
            child.setAttribute('rel', withNoopener.includes('noreferrer') ? withNoopener : `${withNoopener} noreferrer`.trim());
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

function toDateOrNull(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  const s = String(input || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function applyFormatter(token, value, locale) {
  const raw = String(token || '').trim();
  if (!raw) return value;
  const [nameRaw, argRaw] = raw.split(':');
  const name = String(nameRaw || '').trim().toLowerCase();
  const arg = String(argRaw || '').trim().toLowerCase();

  if (name === 'date' || name === 'datetime') {
    const d = toDateOrNull(value);
    if (!d) return value;
    if (name === 'datetime') return d.toLocaleString(locale);
    const opts =
      arg === 'long'
        ? { year: 'numeric', month: 'long', day: '2-digit' }
        : arg === 'medium'
          ? { year: 'numeric', month: 'short', day: '2-digit' }
          : { year: 'numeric', month: '2-digit', day: '2-digit' };
    return d.toLocaleDateString(locale, opts);
  }

  if (name === 'upper') return String(value ?? '').toUpperCase();
  if (name === 'lower') return String(value ?? '').toLowerCase();
  if (name === 'trim') return String(value ?? '').trim();

  return value;
}

function interpolateText(text, data, locale, opts = {}) {
  const s = String(text || '');
  return s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
    const raw = String(expr || '').trim();
    if (!raw) return '';
    const parts = raw.split('|').map((p) => String(p || '').trim()).filter(Boolean);
    const path = parts[0] || '';
    const formatters = parts.slice(1);
    let v = getValue(path, data);
    if (v == null) v = '';
    for (const f of formatters) {
      v = applyFormatter(f, v, locale);
    }
    const out = v == null ? '' : String(v);
    return opts.escapeValue ? escapeHtml(out) : out;
  });
}

function textAlignClass(align) {
  const a = String(align || '').toLowerCase();
  if (a === 'center') return 'text-center';
  if (a === 'right') return 'text-right';
  return 'text-left';
}

const PublicRenderer = ({ layout, data, className = '', disableCertificateEmbed = false }) => {
  const { t, locale } = useT();
  const layoutSafe = Array.isArray(layout) ? layout : null;

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(!!mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const blocks = useMemo(() => {
    return (layoutSafe || []).map((block) => {
      const rect = isMobile ? block.mobile || block.desktop || block : block.desktop || block.mobile || block;
      return {
        ...block,
        __rect: {
          x: rect.x ?? 0,
          y: rect.y ?? 0,
          w: rect.w ?? 0,
          h: rect.h ?? 0
        }
      };
    });
  }, [isMobile, layoutSafe]);

  const containerHeight = useMemo(() => {
    if (!layoutSafe) return null;
    let maxBottom = 0;
    for (const b of blocks) {
      const bottom = Number(b?.__rect?.y || 0) + Number(b?.__rect?.h || 0);
      if (Number.isFinite(bottom)) maxBottom = Math.max(maxBottom, bottom);
    }
    return maxBottom > 0 ? maxBottom : null;
  }, [blocks, layoutSafe]);

  const renderBlock = (block) => {
    const style = {
      position: 'absolute',
      left: `${block.__rect.x}px`,
      top: `${block.__rect.y}px`,
      width: `${block.__rect.w}px`,
      height: `${block.__rect.h}px`,
    };

    switch (block.type) {
      case 'container':
        {
          const bg = String(block.content?.backgroundColor || '#ffffff');
          const borderColor = String(block.content?.borderColor || '#e4e4e7');
          const borderWidth = Number(block.content?.borderWidth ?? 1);
          const radius = Number(block.content?.borderRadius ?? 12);
          const opacity = Math.max(0, Math.min(1, Number(block.content?.opacity ?? 1)));
          return (
            <div
              key={block.id}
              style={{
                ...style,
                backgroundColor: bg,
                borderColor,
                borderWidth: Number.isFinite(borderWidth) ? borderWidth : 1,
                borderStyle: 'solid',
                borderRadius: Number.isFinite(radius) ? radius : 12,
                opacity
              }}
            />
          );
        }
      case 'text':
        {
          const interpolated = interpolateText(block.content?.text || '', data, locale, { escapeValue: true });
          const html = sanitizeLimitedHtml(interpolated);
          return (
            <div key={block.id} style={style} className="overflow-hidden">
              <div className="ac-richtext text-sm text-zinc-900" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }
      case 'image':
        {
          const mode = String(block.content?.mode || 'fit');
          const isStretch = mode === 'stretch';
          return (
            <div key={block.id} style={style} className="overflow-hidden">
              {block.content?.url ? (
                <img src={block.content.url} alt="" className={isStretch ? 'h-full w-full object-fill' : 'h-full w-full object-contain'} />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
                  {t('image')}
                </div>
              )}
            </div>
          );
        }
      case 'certificate':
        {
          const status = String(data?.status || '').toUpperCase();
          const ok = status === 'VALID';
          const productName = data?.product?.name || '-';
          const batchNo = data?.batch?.batchNo || '-';
          const issued = data?.issuedAt ? new Date(data.issuedAt) : null;
          const netWeight = data?.epcItem?.netWeight || null;
          const caiqNumber = data?.epcItem?.caiqNumber || null;
          const productionDate = data?.epcItem?.productionDate ? new Date(data.epcItem.productionDate) : null;

          const template = data?.certificateTemplate || null;
          const templateLayout = normalizeJsonArray(template?.layoutJson);
          if (!disableCertificateEmbed && template && templateLayout) {
            const rawW = Number(template?.canvasWidth || block.content?.canvasWidth || 390);
            const rawH = Number(template?.canvasHeight || block.content?.canvasHeight || 844);
            const baseW = Number.isFinite(rawW) && rawW > 0 ? rawW : 390;
            const baseH = Number.isFinite(rawH) && rawH > 0 ? rawH : 844;
            const scale = Math.max(0.1, Math.min(4, Math.min((block.__rect.w || baseW) / baseW, (block.__rect.h || baseH) / baseH)));

            const placeholdersArr = normalizeJsonArray(template?.placeholders) || [];
            const placeholderByKey = new Map(
              placeholdersArr
                .map((p) => {
                  const k = String(p?.key || '').trim();
                  if (!k) return null;
                  return [k, p];
                })
                .filter(Boolean)
            );
            const bgColor = String(template?.backgroundColor || '#ffffff');
            const bgUrl = template?.background ? String(template.background) : '';
            const bgMode = String(template?.backgroundMode || 'background');

            const items = templateLayout
              .filter((it) => it && typeof it === 'object')
              .map((it) => ({
                id: String(it.id || ''),
                x: Number(it.x) || 0,
                y: Number(it.y) || 0,
                w: Number(it.w) || 0,
                h: Number(it.h) || 0,
                path: String(it.path || ''),
                label: String(it.label || ''),
                fontSize: Number(it.fontSize) > 0 ? Number(it.fontSize) : 14,
                align: String(it.align || 'left')
              }));

            return (
              <div key={block.id} style={style} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div style={{ width: baseW * scale, height: baseH * scale }} className="mx-auto">
                  <div style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative overflow-hidden">
                    <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
                    {bgUrl ? (
                      bgMode === 'actual' ? (
                        <img
                          src={bgUrl}
                          alt=""
                          className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-center"
                          draggable={false}
                        />
                      ) : bgMode === 'fit' ? (
                        <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-contain object-center" draggable={false} />
                      ) : (
                        <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-fill object-center" draggable={false} />
                      )
                    ) : null}
                    {items.map((it, idx) => {
                      const raw = it.path ? getValue(it.path, data) : '';
                      const path = String(it.path || '');
                      const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
                      const ph = key ? placeholderByKey.get(key) : null;
                      let val = raw == null ? '' : String(raw);
                      const source = String(ph?.source || '').trim() || 'manual';
                      const showPrefix = source !== 'title';
                      const label = showPrefix ? (key ? String(ph?.label || key) : String(it.label || '')) : '';
                      const separator = showPrefix ? (key ? String(ph?.separator ?? ': ') : ': ') : '';
                      const prefix = showPrefix && label ? `${label}${separator}` : '';
                      if (!String(val || '').trim() && ph) {
                        if (source === 'static' || source === 'title') {
                          val = String(ph?.staticValue || '');
                        } else if (source === 'product') {
                          const bindPath = String(ph?.bindPath || '').trim();
                          if (bindPath) {
                            const v = getValue(bindPath, {
                              product: data?.product || null,
                              batch: data?.batch || null,
                              certificate: data || null,
                              epcItem: data?.epcItem || null
                            });
                            val = v == null ? '' : String(v);
                          }
                        }
                      }
                      const hasValue = String(val || '').trim().length > 0;
                      if (!hasValue && source !== 'static' && source !== 'title') return null;
                      const valueHtml = source === 'static' || source === 'manual' || source === 'title' ? sanitizeLimitedHtml(val) : escapeTextToHtml(val);
                      const html = `${escapeHtml(prefix)}${valueHtml || ''}`;
                      if (!String(html || '').trim()) return null;
                      return (
                        <div
                          key={it.id || `${idx}`}
                          className="absolute overflow-hidden px-2 text-zinc-900"
                          style={{
                            left: `${it.x}px`,
                            top: `${it.y}px`,
                            width: `${it.w}px`,
                            height: `${it.h}px`,
                            fontSize: `${it.fontSize}px`,
                            lineHeight: 1.2
                          }}
                        >
                          <div className={`ac-richtext h-full w-full font-semibold ${textAlignClass(it.align)}`} dangerouslySetInnerHTML={{ __html: html }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }
        return (
          <div
            key={block.id}
            style={style}
            className={`flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border p-4 ${
              ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">{t('certificateTitle')}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-900">{t('certificateStatusSubtitle')}</div>
                <div className={`rounded-full bg-white/70 px-2 py-1 text-xs font-semibold ${ok ? 'text-emerald-900' : 'text-rose-900'}`}>{status || '-'}</div>
              </div>
              <div className="mt-3 rounded-xl border border-white/40 bg-white/60 px-3 py-2">
                <div className="text-[11px] font-semibold text-zinc-600">{t('certificateId')}</div>
                <div className="mt-1 font-mono text-xs text-zinc-900">{data?.certificateId || '-'}</div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-xs text-zinc-800">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{t('product')}:</span>
                <span className="truncate">{productName}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="font-semibold">{t('batch')}:</span>
                <span className="truncate">{batchNo}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="font-semibold">{t('issued')}:</span>
                <span className="truncate">{issued ? issued.toLocaleDateString(locale) : '-'}</span>
              </div>
              {netWeight || caiqNumber || productionDate ? (
                <div className="mt-2 border-t border-white/40 pt-2">
                  {netWeight ? (
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">{t('netWeight')}:</span>
                      <span className="truncate">{String(netWeight)}</span>
                    </div>
                  ) : null}
                  {caiqNumber ? (
                    <div className={`flex justify-between gap-3${netWeight ? ' mt-1' : ''}`}>
                      <span className="font-semibold">{t('caiqNo')}:</span>
                      <span className="truncate">{String(caiqNumber)}</span>
                    </div>
                  ) : null}
                  {productionDate ? (
                    <div className={`flex justify-between gap-3${netWeight || caiqNumber ? ' mt-1' : ''}`}>
                      <span className="font-semibold">{t('productionDate')}:</span>
                      <span className="truncate">{productionDate.toLocaleDateString(locale)}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
        }
      case 'video':
        return (
          <div key={block.id} style={style}>
            {block.content?.url ? (
              <video src={block.content.url} controls className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
                {t('video')}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`relative w-full bg-white ${className || ''}`} style={containerHeight ? { minHeight: `${containerHeight}px` } : undefined}>
      {layoutSafe ? blocks.map(renderBlock) : null}
    </div>
  );
};

export default PublicRenderer;
