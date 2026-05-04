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

function interpolateText(text, data, locale) {
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
    return v == null ? '' : String(v);
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
        return (
          <div key={block.id} style={style} className="overflow-hidden">
            <p className="whitespace-pre-wrap text-sm text-zinc-900">{interpolateText(block.content?.text || '', data, locale)}</p>
          </div>
        );
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
          const certLayout = !disableCertificateEmbed && Array.isArray(data?.certificateLayout) ? data.certificateLayout : null;
          if (certLayout) {
            const rawW = Number(data?.certificateTemplate?.canvasWidth || block.content?.canvasWidth || 390);
            const rawH = Number(data?.certificateTemplate?.canvasHeight || block.content?.canvasHeight || 844);
            const baseW = Number.isFinite(rawW) && rawW > 0 ? rawW : 390;
            const baseH = Number.isFinite(rawH) && rawH > 0 ? rawH : 844;
            const scale = Math.max(0.1, Math.min(4, Math.min((block.__rect.w || baseW) / baseW, (block.__rect.h || baseH) / baseH)));
            return (
              <div key={block.id} style={style} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div style={{ width: baseW * scale, height: baseH * scale }} className="mx-auto">
                  <div style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <PublicRenderer layout={certLayout} data={data} disableCertificateEmbed />
                  </div>
                </div>
              </div>
            );
          }

          const template = data?.certificateTemplate || null;
          const templateLayout = Array.isArray(template?.layoutJson) ? template.layoutJson : null;
          if (template && templateLayout) {
            const rawW = Number(template?.canvasWidth || block.content?.canvasWidth || 390);
            const rawH = Number(template?.canvasHeight || block.content?.canvasHeight || 844);
            const baseW = Number.isFinite(rawW) && rawW > 0 ? rawW : 390;
            const baseH = Number.isFinite(rawH) && rawH > 0 ? rawH : 844;
            const scale = Math.max(0.1, Math.min(4, Math.min((block.__rect.w || baseW) / baseW, (block.__rect.h || baseH) / baseH)));

            const placeholderByKey = new Map(
              (Array.isArray(template?.placeholders) ? template.placeholders : [])
                .map((p) => {
                  const k = String(p?.key || '').trim();
                  if (!k) return null;
                  return [k, p];
                })
                .filter(Boolean)
            );
            const bgColor = String(template?.backgroundColor || '#ffffff');
            const bgUrl = template?.background ? String(template.background) : '';

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
                    {bgUrl ? <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                    {items.map((it, idx) => {
                      const raw = it.path ? getValue(it.path, data) : '';
                      const path = String(it.path || '');
                      const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
                      const ph = key ? placeholderByKey.get(key) : null;
                      const val = raw == null ? '' : String(raw);
                      const source = String(ph?.source || '').trim();
                      const showPrefix = source !== 'title';
                      const label = showPrefix ? (key ? String(ph?.label || key) : String(it.label || '')) : '';
                      const separator = showPrefix ? (key ? String(ph?.separator ?? ': ') : ': ') : '';
                      const prefix = showPrefix && label ? `${label}${separator}` : '';
                      const text = `${prefix}${val || ''}`;
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
                          <div className={`h-full w-full font-semibold ${textAlignClass(it.align)}`}>{text}</div>
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
