import React, { useEffect, useMemo, useRef } from 'react';
import CanvasStage from '../CanvasStage';
import PublicRenderer from '../../PublicRenderer';
import { useT } from '../../../i18n/useT';

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function sampleCert(id = 'BN-TEST-123') {
  return {
    certificateId: id,
    type: 'unit',
    status: 'VALID',
    issuedAt: new Date().toISOString(),
    product: { name: 'Premium Bird Nest (Gold Edition)', code: 'PBN-G-001' },
    batch: { batchNo: 'BATCH-2024-04' }
  };
}

export default function CmsCanvasPanel({ viewMode, selectedPage, layout, setLayout, selectedBlockId, setSelectedBlockId }) {
  const { t } = useT();
  const layoutRef = useRef(layout);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout, t]);

  const setCanvasItems = (updaterOrNext) => {
    const current = layoutRef.current || [];
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(current) : updaterOrNext;
    setLayout(next);
  };

  const blocks = useMemo(() => {
    return layout.map((b) => ({
      ...b,
      render: (it) => {
        if (it.type === 'text') {
          return (
            <div className="h-full w-full p-2">
              <div className="text-xs font-semibold text-zinc-800">{t('text')}</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">{it.content?.text || t('text')}</div>
            </div>
          );
        }
        if (it.type === 'image') {
          return (
            <div className="h-full w-full">
              <img src={it.content?.url || ''} alt="" className="h-full w-full object-cover" draggable={false} />
            </div>
          );
        }
        if (it.type === 'video') {
          return (
            <div className="h-full w-full p-2">
              <div className="text-xs font-semibold text-zinc-800">Video</div>
              <div className="mt-1 text-xs text-zinc-600 break-all">{it.content?.url || t('url')}</div>
            </div>
          );
        }
        if (it.type === 'certificate') {
          return (
            <div className="flex h-full w-full items-center justify-center p-2">
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800">
                {t('certificateTitle')}
              </div>
            </div>
          );
        }
        return (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">Unknown</div>
        );
      }
    }));
  }, [layout, t]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-zinc-500">{t('canvas')}</div>
          <div className="text-sm font-semibold text-zinc-900">{selectedPage ? selectedPage.name : t('selectPage')}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = [
                ...layout,
                { id: makeId('text'), type: 'text', x: 20, y: 20, w: 240, h: 80, content: { text: 'New text' } }
              ];
              setLayout(next);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            {t('addText')}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = [
                ...layout,
                {
                  id: makeId('image'),
                  type: 'image',
                  x: 20,
                  y: 120,
                  w: 260,
                  h: 160,
                  content: {
                    url: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=luxury%20premium%20packaging%20product%20photo%2C%20studio%20lighting&image_size=landscape_4_3'
                  }
                }
              ];
              setLayout(next);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            {t('addImage')}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = [...layout, { id: makeId('video'), type: 'video', x: 20, y: 300, w: 260, h: 80, content: { url: '' } }];
              setLayout(next);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            {t('addVideo')}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = [...layout, { id: makeId('cert'), type: 'certificate', x: 20, y: 400, w: 320, h: 220 }];
              setLayout(next);
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            {t('addCertificate')}
          </button>
        </div>
      </div>

      {viewMode === 'preview' ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <div className="max-h-[740px] overflow-auto bg-white">
            <PublicRenderer layout={layout} data={sampleCert()} />
          </div>
        </div>
      ) : (
        <CanvasStage
          width={420}
          height={740}
          items={blocks}
          setItems={setCanvasItems}
          selectedId={selectedBlockId}
          setSelectedId={setSelectedBlockId}
        />
      )}
    </div>
  );
}
