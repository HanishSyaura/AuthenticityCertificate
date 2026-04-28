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
            <p className="whitespace-pre-wrap">{block.content.text}</p>
          </div>
        );
      case 'image':
        return (
          <div key={block.id} style={style}>
            <img 
              src={block.content.url} 
              alt="Block content" 
              className="w-full h-full object-contain"
            />
          </div>
        );
      case 'certificate':
        return (
          <div key={block.id} style={style} className="border-2 border-accent p-4 bg-white rounded shadow-lg flex flex-col items-center justify-center text-center">
             <h3 className="text-xl font-bold text-primary mb-2">{t('certificateTitle')}</h3>
             <p className="text-sm text-gray-600">{t('certificateStatusSubtitle')}</p>
             <p className={`text-2xl font-bold my-2 ${data.status === 'VALID' ? 'text-green-600' : 'text-red-600'}`}>
               {data.status}
             </p>
             <p className="text-xs font-mono bg-gray-100 p-1 px-2 rounded">{data.certificateId}</p>
             <div className="mt-4 text-left w-full border-t pt-2 text-xs">
                <p><strong>{t('product')}:</strong> {data.product.name}</p>
                <p><strong>{t('batch')}:</strong> {data.batch.batchNo}</p>
                <p><strong>{t('issued')}:</strong> {new Date(data.issuedAt).toLocaleDateString(locale)}</p>
             </div>
          </div>
        );
      case 'video':
        return (
          <div key={block.id} style={style}>
            <video 
              src={block.content.url} 
              controls 
              className="w-full h-full object-cover"
            />
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
