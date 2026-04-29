import React, { useEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../CanvasStage';
import PublicRenderer from '../../PublicRenderer';
import { useT } from '../../../i18n/useT';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { createAdminApi } from '../../../utils/adminApi';

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function sampleCert(id = 'CERTIFICATE_ID') {
  return {
    certificateId: id,
    type: 'unit',
    status: 'VALID',
    issuedAt: new Date().toISOString(),
    product: { name: 'PRODUCT_NAME', code: 'PRODUCT_CODE' },
    batch: { batchNo: 'BATCH_NO' }
  };
}

export default function CmsCanvasPanel({ viewMode, selectedPage, layout, setLayout, selectedBlockId, setSelectedBlockId }) {
  const { t } = useT();
  const token = useAdminAuthStore((s) => s.token);
  const layoutRef = useRef(layout);

  const [previewCertId, setPreviewCertId] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);

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
                    url: ''
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
          <div className="border-b border-zinc-200 bg-zinc-50 p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="text-[11px] font-semibold text-zinc-600">{t('previewCertificateId')}</div>
                <input
                  value={previewCertId}
                  onChange={(e) => setPreviewCertId(e.target.value)}
                  placeholder="CERTIFICATE_ID"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-zinc-400"
                />
                <div className="mt-1 text-[11px] text-zinc-500">{t('previewCertificateHint')}</div>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={async () => {
                  setPreviewError(null);
                  const id = String(previewCertId || '').trim();
                  if (!id) {
                    setPreviewData(null);
                    return;
                  }
                  try {
                    const api = createAdminApi({ token });
                    const res = await api.get(`/certificates/${encodeURIComponent(id)}`);
                    const cert = res?.data?.data;
                    const mapped = {
                      certificateId: cert?.certificateId,
                      type: cert?.type,
                      status: cert?.status,
                      issuedAt: cert?.issuedAt || cert?.createdAt,
                      expiresAt: cert?.expiresAt || null,
                      product: cert?.batch?.product ? { name: cert.batch.product.name, code: cert.batch.product.code } : { name: 'PRODUCT_NAME', code: 'PRODUCT_CODE' },
                      batch: cert?.batch ? { batchNo: cert.batch.batchNo } : { batchNo: 'BATCH_NO' }
                    };
                    setPreviewData(mapped);
                  } catch (e) {
                    const msg = e?.response?.data?.message || e?.message || 'Failed to load certificate';
                    setPreviewData(null);
                    setPreviewError(msg);
                  }
                }}
              >
                {t('load')}
              </button>
            </div>
            {previewError ? <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{previewError}</div> : null}
          </div>
          <div className="max-h-[740px] overflow-auto bg-white">
            <PublicRenderer layout={layout} data={previewData || sampleCert()} />
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
