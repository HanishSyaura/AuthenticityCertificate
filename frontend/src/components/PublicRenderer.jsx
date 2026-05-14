import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import { stripHtmlToText } from '../utils/richText';
import { buildUploadsWebpSrcSet } from '../utils/mediaVariants';
import { resolvePublicMediaUrl } from '../utils/apiBase';
import { resolveCmsVideoSource } from '../utils/videoEmbed';
import PdfLightbox from './PdfLightbox';
import PdfFirstPageThumb from './PdfFirstPageThumb';

const ImageLightbox = ({ src, onClose }) => {
  useEffect(() => {
    const prevOverflow = document?.body?.style?.overflow ?? '';
    if (document?.body?.style) document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (document?.body?.style) document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <button
        type="button"
        className="absolute right-4 top-4 rounded bg-black/50 px-3 py-1 text-sm text-white"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
      >
        ×
      </button>
      <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="" className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain" draggable={false} />
      </div>
    </div>
  );
};

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

function sanitizeClass(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const allowed = new Set(['ql-align-left', 'ql-align-center', 'ql-align-right', 'ql-align-justify']);
  const kept = raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((c) => allowed.has(c) || /^ql-indent-[1-8]$/.test(c) || /^ql-font-[a-z0-9-]{1,30}$/i.test(c));
  return kept.join(' ');
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
    'SUP',
    'DIV',
    'P',
    'SPAN',
    'UL',
    'OL',
    'LI'
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

function inlineizeHtml(input) {
  let s = String(input || '');
  if (!s) return '';
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<(\/?)p(\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  s = s.replace(/<(\/?)div(\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  s = s.replace(/<(\/?)blockquote(\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  s = s.replace(/<(\/?)h[1-6](\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  return s;
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

function pad2(input) {
  return String(Number(input) || 0).padStart(2, '0');
}

function formatYmdValue(input) {
  if (input == null) return '';
  const s = String(input ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = toDateOrNull(input);
  if (!d) return s;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatNetWeightValue(input) {
  if (input == null) return '';
  const s = String(input ?? '').trim();
  if (!s) return '';
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(g)?$/i);
  if (m) return `${m[1]} g`;
  return s;
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

const CmsVideoBlock = ({ block, style, t }) => {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [activated, setActivated] = useState(false);

  const raw = useMemo(() => String(block?.content?.url || '').trim(), [block]);
  const resolved = useMemo(() => {
    return raw ? resolveCmsVideoSource(raw, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid') : null;
  }, [raw]);

  const posterRaw = String(block?.content?.posterUrl || block?.content?.poster || '').trim();
  const poster = posterRaw ? resolvePublicMediaUrl(posterRaw) : '';

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      setShouldLoad(true);
      return;
    }
    let alive = true;
    const obs = new window.IntersectionObserver(
      (entries) => {
        if (!alive) return;
        const hit = entries.some((e) => e && e.isIntersecting);
        if (hit) {
          setShouldLoad(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0.01 }
    );
    obs.observe(el);
    return () => {
      alive = false;
      obs.disconnect();
    };
  }, []);

  const active = shouldLoad || activated;

  useEffect(() => {
    if (!active) return;
    const el = videoRef.current;
    if (!el) return;
    try {
      el.load?.();
    } catch {
    }
  }, [active]);

  return (
    <div
      ref={wrapRef}
      style={style}
      className={active ? '' : 'cursor-pointer'}
      onClick={() => {
        if (!active) setActivated(true);
      }}
      role={!active ? 'button' : undefined}
      tabIndex={!active ? 0 : undefined}
      onKeyDown={(e) => {
        if (active) return;
        if (e.key === 'Enter' || e.key === ' ') setActivated(true);
      }}
      aria-label={!active ? (t ? t('video') : 'video') : undefined}
    >
      {resolved?.kind === 'iframe' ? (
        active ? (
          <iframe
            title="video"
            src={resolved.src}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
            {t ? t('video') : 'video'}
          </div>
        )
      ) : resolved?.kind === 'video' ? (
        <video
          ref={videoRef}
          src={active ? resolved.src : undefined}
          controls
          playsInline
          preload={active ? 'metadata' : 'none'}
          poster={poster || undefined}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
          {t ? t('video') : 'video'}
        </div>
      )}
    </div>
  );
};

const PublicRenderer = ({ layout, data, className = '', disableCertificateEmbed = false, responsive = false, responsiveMode = 'container', baseWidth = 390 }) => {
  const { t, locale } = useT();
  const layoutSafe = Array.isArray(layout) ? layout : null;

  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef(null);
  const [targetW, setTargetW] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [pdfSrc, setPdfSrc] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setIsMobile(!!mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (!responsive) return;
    const measure = () => {
      if (responsiveMode === 'viewport') {
        const docW = Number(document.documentElement?.clientWidth || 0);
        const winW = Number(window.innerWidth || 0);
        const w = Math.min(
          ...[docW, winW].filter((n) => Number.isFinite(n) && n > 0)
        );
        setTargetW(Number.isFinite(w) && w > 0 ? w : null);
        return;
      }
      const el = containerRef.current;
      const w = Number(el?.clientWidth || 0);
      setTargetW(Number.isFinite(w) && w > 0 ? w : null);
    };
    measure();

    if (responsiveMode === 'viewport') {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }

    const el = containerRef.current;
    if (!el) return;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [responsive, responsiveMode]);

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

  const eagerImageIds = useMemo(() => {
    const candidates = [];
    for (const b of blocks) {
      if (!b || b.type !== 'image') continue;
      const url = String(b?.content?.url || '').trim();
      if (!url) continue;
      candidates.push({ id: String(b.id || ''), y: Number(b?.__rect?.y || 0) });
    }
    candidates.sort((a, b) => a.y - b.y);
    return new Set(candidates.slice(0, 1).map((it) => it.id));
  }, [blocks]);

  const baseW = useMemo(() => {
    const raw = Number(baseWidth);
    return Number.isFinite(raw) && raw > 0 ? raw : 390;
  }, [baseWidth]);

  const scale = useMemo(() => {
    if (!responsive) return 1;
    const w = Number(targetW || 0);
    if (!Number.isFinite(w) || w <= 0) return 1;
    return Math.max(0.1, Math.min(4, w / baseW));
  }, [baseW, responsive, targetW]);

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
          const fill = String(block.content?.backgroundFill || 'solid');
          const bg = String(block.content?.backgroundColor || '#ffffff');
          const from = String(block.content?.gradientFrom || bg || '#ffffff');
          const to = String(block.content?.gradientTo || '#ffffff');
          const angleRaw = Number(block.content?.gradientAngle ?? 180);
          const angle = Number.isFinite(angleRaw) ? Math.max(0, Math.min(360, angleRaw)) : 180;
          const borderColor = String(block.content?.borderColor || '#e4e4e7');
          const borderWidth = Number(block.content?.borderWidth ?? 1);
          const radius = Number(block.content?.borderRadius ?? 12);
          const opacity = Math.max(0, Math.min(1, Number(block.content?.opacity ?? 1)));
          return (
            <div
              key={block.id}
              style={{
                ...style,
                backgroundColor: fill === 'gradient' ? undefined : bg,
                backgroundImage: fill === 'gradient' ? `linear-gradient(${angle}deg, ${from}, ${to})` : undefined,
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
          const fs = Number(block.content?.fontSize) > 0 ? Number(block.content.fontSize) : 14;
          const color = String(block.content?.fontColor || '').trim() || '#18181b';
          return (
            <div key={block.id} style={style} className="overflow-hidden">
              <div
                className="ql-editor ac-richtext"
                style={{ fontSize: `${fs}px`, lineHeight: 1.2, color }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          );
        }
      case 'image':
        {
          const mode = String(block.content?.mode || 'fit');
          const isStretch = mode === 'stretch';
          const isEager = eagerImageIds.has(String(block.id || ''));
          const resolvedUrl = block.content?.url ? resolvePublicMediaUrl(String(block.content.url)) : '';
          const webpSrcSet = resolvedUrl ? buildUploadsWebpSrcSet(resolvedUrl) : null;
          const renderedW = Math.max(1, Math.round((Number(block.__rect?.w || 0) || 0) * (Number(scale) || 1)));
          const sizes = `${renderedW}px`;
          return (
            <div key={block.id} style={style} className="overflow-hidden">
              {resolvedUrl ? (
                webpSrcSet ? (
                  <picture className="block h-full w-full">
                    <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
                    <img
                      src={resolvedUrl}
                      alt=""
                      className={`${isStretch ? 'h-full w-full object-fill' : 'h-full w-full object-contain'} cursor-zoom-in`}
                      loading={isEager ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={isEager ? 'high' : 'low'}
                      draggable={false}
                      onClick={() => setLightboxSrc(resolvedUrl)}
                    />
                  </picture>
                ) : (
                  <img
                    src={resolvedUrl}
                    alt=""
                    className={`${isStretch ? 'h-full w-full object-fill' : 'h-full w-full object-contain'} cursor-zoom-in`}
                    loading={isEager ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={isEager ? 'high' : 'low'}
                    draggable={false}
                    onClick={() => setLightboxSrc(resolvedUrl)}
                  />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
                  {t('image')}
                </div>
              )}
            </div>
          );
        }
      case 'supporting_document':
        {
          const docType = String(block.content?.docType || '').trim();
          const batchDocs = Array.isArray(data?.batchDocuments) ? data.batchDocuments : [];
          const row = batchDocs.find((d) => String(d?.docType || '').trim() === docType) || null;
          const url = row?.mediaUrl ? String(row.mediaUrl).trim() : '';
          const resolvedUrl = resolvePublicMediaUrl(url);
          const labelRaw = String(block.content?.label || '').trim();
          const label =
            labelRaw ||
            (docType === 'moh_health_certificate'
              ? t('mohHealthCertificate')
              : docType === 'export_permit'
                ? t('exportPermit')
                : docType === 'dvs_health_certificate'
                  ? t('dvsHealthCertificate')
                  : docType === 'dvs_coo_certificate'
                    ? t('dvsCooCertificate')
                    : t('supportingCertificates'));

          const fill = String(block.content?.backgroundFill || 'solid');
          const bg = String(block.content?.backgroundColor || '#ffffff');
          const from = String(block.content?.gradientFrom || bg || '#ffffff');
          const to = String(block.content?.gradientTo || '#ffffff');
          const angleRaw = Number(block.content?.gradientAngle ?? 180);
          const angle = Number.isFinite(angleRaw) ? Math.max(0, Math.min(360, angleRaw)) : 180;
          const borderColor = String(block.content?.borderColor || '#e4e4e7');
          const borderWidth = Number(block.content?.borderWidth ?? 1);
          const radius = Number(block.content?.borderRadius ?? 16);
          const opacity = Math.max(0, Math.min(1, Number(block.content?.opacity ?? 1)));

          const canOpen = Boolean(resolvedUrl);
          return (
            <button
              key={block.id}
              type="button"
              disabled={!canOpen}
              aria-label={label}
              onClick={() => {
                if (!canOpen) return;
                setPdfTitle(label || 'PDF');
                setPdfSrc(resolvedUrl);
              }}
              style={{
                ...style,
                backgroundColor: fill === 'gradient' ? undefined : bg,
                backgroundImage: fill === 'gradient' ? `linear-gradient(${angle}deg, ${from}, ${to})` : undefined,
                borderColor,
                borderWidth: Number.isFinite(borderWidth) ? borderWidth : 1,
                borderStyle: 'solid',
                borderRadius: Number.isFinite(radius) ? radius : 16,
                opacity
              }}
              className={`group overflow-hidden ${canOpen ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
            >
              <PdfFirstPageThumb src={resolvedUrl} title={label || 'PDF'} className="h-full w-full" fit="contain" silent />
            </button>
          );
        }
      case 'certificate':
        {
          const variant = String(block.content?.variant || 'auth');
          const supportingTemplateId = block.content?.certificateTemplateId != null ? Number(block.content.certificateTemplateId) : null;
          const supportingTemplatesArr = Array.isArray(data?.supportingTemplates) ? data.supportingTemplates : [];
          const supportingTemplate =
            variant === 'supporting' && supportingTemplateId != null
              ? supportingTemplatesArr.find((t) => Number(t?.id) === supportingTemplateId) || null
              : null;
          const dataForTemplate = data;

          const status = String(data?.status || '').toUpperCase();
          const ok = status === 'VALID';
          const productName = data?.product?.name || '-';
          const batchNo = data?.batch?.batchNo || '-';
          const issued = data?.issuedAt ? new Date(data.issuedAt) : null;
          const netWeightRaw = data?.epcItem?.netWeight ?? null;
          const caiqNumberRaw = data?.epcItem?.caiqNumber ?? null;
          const productionDateRaw = data?.epcItem?.productionDate ?? null;
          const netWeightText = formatNetWeightValue(netWeightRaw);
          const caiqNumberText = caiqNumberRaw == null ? '' : String(caiqNumberRaw).trim();
          const productionDateText = formatYmdValue(productionDateRaw);
          const showEpcDetails = Boolean(netWeightText || caiqNumberText || productionDateText);

          const template = variant === 'supporting' ? supportingTemplate : data?.certificateTemplate || null;
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
            const bgUrl = template?.background ? resolvePublicMediaUrl(String(template.background)) : '';
            const bgMode = String(template?.backgroundMode || 'background');
            const bgSrcSet = bgUrl ? buildUploadsWebpSrcSet(bgUrl) : null;
            const bgSizes = `${Math.max(1, Math.round(baseW * scale))}px`;

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
                labelHtml: String(it.labelHtml || ''),
                fontSize: Number(it.fontSize) > 0 ? Number(it.fontSize) : 14,
                align: String(it.align || 'left'),
                wrap: typeof it.wrap === 'boolean' ? it.wrap : true
              }));

            return (
              <div key={block.id} style={style} className="overflow-hidden rounded-none">
                <div style={{ width: baseW * scale, height: baseH * scale }} className="mx-auto">
                  <div style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative overflow-hidden">
                    <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
                    {bgUrl ? (
                      bgMode === 'actual' ? (
                        bgSrcSet ? (
                          <picture className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                            <source type="image/webp" srcSet={bgSrcSet} sizes={bgSizes} />
                            <img
                              src={bgUrl}
                              alt=""
                              className="max-w-none object-center"
                              loading="eager"
                              decoding="async"
                              fetchPriority="high"
                              draggable={false}
                            />
                          </picture>
                        ) : (
                          <img
                            src={bgUrl}
                            alt=""
                            className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-center"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            draggable={false}
                          />
                        )
                      ) : bgMode === 'fit' ? (
                        bgSrcSet ? (
                          <picture className="absolute inset-0 h-full w-full">
                            <source type="image/webp" srcSet={bgSrcSet} sizes={bgSizes} />
                            <img
                              src={bgUrl}
                              alt=""
                              className="h-full w-full object-contain object-center"
                              loading="eager"
                              decoding="async"
                              fetchPriority="high"
                              draggable={false}
                            />
                          </picture>
                        ) : (
                          <img
                            src={bgUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-contain object-center"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            draggable={false}
                          />
                        )
                      ) : (
                        bgSrcSet ? (
                          <picture className="absolute inset-0 h-full w-full">
                            <source type="image/webp" srcSet={bgSrcSet} sizes={bgSizes} />
                            <img
                              src={bgUrl}
                              alt=""
                              className="h-full w-full object-fill object-center"
                              loading="eager"
                              decoding="async"
                              fetchPriority="high"
                              draggable={false}
                            />
                          </picture>
                        ) : (
                          <img
                            src={bgUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-fill object-center"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            draggable={false}
                          />
                        )
                      )
                    ) : null}
                    {items.map((it, idx) => {
                      const raw = it.path ? getValue(it.path, dataForTemplate) : '';
                      const path = String(it.path || '');
                      const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
                      const ph = key ? placeholderByKey.get(key) : null;
                      let val = raw == null ? '' : String(raw);
                      let effectivePath = path;
                      const source = String(ph?.source || '').trim() || 'manual';
                      const showPrefix = source !== 'title';
                      const labelText = showPrefix
                        ? key
                          ? String(stripHtmlToText(ph?.labelHtml ?? ph?.label ?? key) || '').trim()
                          : String(stripHtmlToText(it.labelHtml ?? it.label ?? '') || '').trim()
                        : '';
                      const prefixHtml =
                        showPrefix && labelText
                          ? key
                            ? `${inlineizeHtml(
                                String(ph?.labelHtml || '').trim() ? sanitizeLimitedHtml(ph.labelHtml) : escapeHtml(String(ph?.label || key))
                              )}${inlineizeHtml(
                                String(ph?.separatorHtml || '').trim()
                                  ? sanitizeLimitedHtml(ph.separatorHtml)
                                  : escapeHtml(String(ph?.separator ?? ': '))
                              )}`
                            : `${inlineizeHtml(
                                String(it.labelHtml || '').trim() ? sanitizeLimitedHtml(it.labelHtml) : escapeHtml(String(it.label || ''))
                              )}${escapeHtml(': ')}`
                          : '';
                      if (ph && (source === 'static' || source === 'title')) {
                        val = String(ph?.staticValue || '');
                      } else if (!String(val || '').trim() && ph) {
                        if (source === 'product') {
                          const bindPath = String(ph?.bindPath || '').trim();
                          if (bindPath) {
                            const normalizedBindPath = bindPath.startsWith('templateData.') ? `certificate.${bindPath}` : bindPath;
                            effectivePath = normalizedBindPath;
                            const v = getValue(normalizedBindPath, {
                              product: dataForTemplate?.product || null,
                              batch: dataForTemplate?.batch || null,
                              certificate: dataForTemplate || null,
                              epcItem: dataForTemplate?.epcItem || null
                            });
                            val = v == null ? '' : String(v);
                          }
                        }
                      }
                      const effectivePathLower = String(effectivePath || '').trim().toLowerCase();
                      const isEpcProductionDate = effectivePathLower === 'epcitem.productiondate';
                      const isEpcNetWeight = effectivePathLower === 'epcitem.netweight';
                      const isEpcDash =
                        isEpcNetWeight ||
                        effectivePathLower === 'epcitem.caiqnumber' ||
                        isEpcProductionDate;
                      if (isEpcProductionDate) {
                        val = formatYmdValue(val);
                      }
                      if (isEpcNetWeight) {
                        val = formatNetWeightValue(val);
                      }
                      if (!String(val || '').trim() && isEpcDash) {
                        val = '-';
                      }
                      const hasValue = String(val || '').trim().length > 0;
                      const hasPrefix = String(prefixHtml || '').trim().length > 0;
                      if (!hasValue && !hasPrefix && source !== 'static' && source !== 'title') return null;
                      const valueHtmlRaw =
                        source === 'static' || source === 'manual' || source === 'batch' || source === 'title' ? sanitizeLimitedHtml(val) : escapeTextToHtml(val);
                      const valueHtml = inlineizeHtml(valueHtmlRaw);
                      const prefixBoldHtml = prefixHtml ? `<span style="font-weight: 700">${prefixHtml}</span>` : '';
                      const html = `${prefixBoldHtml}${valueHtml || ''}`;
                      if (!String(html || '').trim()) return null;
                      const wrap = typeof it.wrap === 'boolean' ? it.wrap : true;
                      return (
                        <div
                          key={it.id || `${idx}`}
                          className="absolute overflow-hidden p-[2px] text-zinc-900"
                          style={{
                            left: `${it.x}px`,
                            top: `${it.y}px`,
                            width: `${it.w}px`,
                            height: `${it.h}px`,
                            fontSize: `${it.fontSize}px`,
                            lineHeight: 1.2
                          }}
                        >
                          <div
                            className={`ql-editor ac-richtext h-full w-full ${textAlignClass(it.align)} ${
                              wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'
                            }`}
                            style={{
                              textAlign: String(it.align || 'left'),
                              whiteSpace: wrap ? 'pre-wrap' : 'nowrap',
                              overflowWrap: wrap ? 'anywhere' : undefined,
                              wordBreak: wrap ? 'break-word' : undefined
                            }}
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
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
            className={`flex h-full w-full flex-col justify-between overflow-hidden rounded-none border p-4 ${
              variant === 'supporting' ? 'border-zinc-200 bg-zinc-50' : ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">{t('certificateTitle')}</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-900">{t('certificateStatusSubtitle')}</div>
                <div
                  className={`rounded-full bg-white/70 px-2 py-1 text-xs font-semibold ${
                    variant === 'supporting' ? 'text-zinc-900' : ok ? 'text-emerald-900' : 'text-rose-900'
                  }`}
                >
                  {variant === 'supporting' ? t('supportingCertificate') : status || '-'}
                </div>
              </div>
              <div className="mt-3 rounded-none border border-white/40 bg-white/60 px-3 py-2">
                <div className="text-[11px] font-semibold text-zinc-600">{t('certificateId')}</div>
                <div className="mt-1 font-mono text-xs text-zinc-900">{data?.certificateId || '-'}</div>
              </div>
            </div>

            <div className="mt-3 rounded-none border border-white/40 bg-white/60 px-3 py-2 text-xs text-zinc-800">
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
              {showEpcDetails ? (
                <div className="mt-2 border-t border-white/40 pt-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">{t('netWeight')}:</span>
                    <span className="truncate">{netWeightText || '-'}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="font-semibold">{t('caiqNo')}:</span>
                    <span className="truncate">{caiqNumberText || '-'}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="font-semibold">{t('productionDate')}:</span>
                    <span className="truncate">{productionDateText || '-'}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
        }
      case 'video':
        return <CmsVideoBlock key={block.id} block={block} style={style} t={t} />;
      default:
        return null;
    }
  };

  if (responsive && layoutSafe && containerHeight) {
    const content = (
      <div
        ref={containerRef}
        className={`w-full overflow-x-hidden ${className || ''}`}
        style={{ minHeight: `${containerHeight * scale}px` }}
      >
        <div className="mx-auto" style={{ width: `${baseW * scale}px`, height: `${containerHeight * scale}px` }}>
          <div
            className="relative"
            style={{ width: `${baseW}px`, height: `${containerHeight}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {blocks.map(renderBlock)}
          </div>
        </div>
      </div>
    );
    return (
      <>
        {content}
        {lightboxSrc ? <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} /> : null}
        {pdfSrc ? <PdfLightbox src={pdfSrc} title={pdfTitle || 'PDF'} onClose={() => setPdfSrc(null)} /> : null}
      </>
    );
  }

  const content = (
    <div
      ref={containerRef}
      className={`relative w-full overflow-x-hidden ${className || ''}`}
      style={containerHeight ? { minHeight: `${containerHeight}px` } : undefined}
    >
      {layoutSafe ? blocks.map(renderBlock) : null}
    </div>
  );

  return (
    <>
      {content}
      {lightboxSrc ? <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} /> : null}
      {pdfSrc ? <PdfLightbox src={pdfSrc} title={pdfTitle || 'PDF'} onClose={() => setPdfSrc(null)} /> : null}
    </>
  );
};

export default PublicRenderer;
