import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/useT';

const PublicRenderer = ({ layout, data }) => {
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

  const renderBlock = (block) => {
    const style = {
      position: 'absolute',
      left: `${block.__rect.x}px`,
      top: `${block.__rect.y}px`,
      width: `${block.__rect.w}px`,
      height: `${block.__rect.h}px`,
    };

    switch (block.type) {
      case 'text':
        return (
          <div key={block.id} style={style} className="overflow-hidden">
            <p className="whitespace-pre-wrap text-sm text-zinc-900">{block.content?.text || ''}</p>
          </div>
        );
      case 'image':
        return (
          <div key={block.id} style={style}>
            {block.content?.url ? (
              <img src={block.content.url} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
                {t('image')}
              </div>
            )}
          </div>
        );
      case 'certificate':
        {
          const status = String(data?.status || '').toUpperCase();
          const ok = status === 'VALID';
          const productName = data?.product?.name || '-';
          const batchNo = data?.batch?.batchNo || '-';
          const issued = data?.issuedAt ? new Date(data.issuedAt) : null;
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
    <div className="relative w-full min-h-screen bg-white">
      {layoutSafe ? blocks.map(renderBlock) : null}
    </div>
  );
};

export default PublicRenderer;
