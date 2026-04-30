import React, { useEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../CanvasStage';
import PublicRenderer from '../../PublicRenderer';
import { useT } from '../../../i18n/useT';
import axios from 'axios';

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured !== undefined) {
    const trimmed = String(configured).trim();
    if (trimmed) return trimmed.replace(/\/+$/, '');
    return '';
  }
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return '';
}

function getPublicApiBaseUrl() {
  const rawBase = getApiBaseUrl();
  const baseURL = rawBase ? rawBase.replace(/\/+$/, '') : '';
  if (!baseURL) return '/public';
  const baseHasApi = baseURL === '/api' || baseURL.endsWith('/api');
  return baseHasApi ? `${baseURL}/public` : `${baseURL}/public`;
}

function sampleCertificateLayout() {
  return [
    { id: 't1', type: 'text', x: 24, y: 24, w: 342, h: 40, content: { text: 'CERTIFICATE' } },
    { id: 't2', type: 'text', x: 24, y: 72, w: 342, h: 52, content: { text: 'This is a sample certificate preview.\nLoad a real Certificate ID or EPC to see actual output.' } },
    { id: 'img1', type: 'image', x: 24, y: 150, w: 342, h: 220, content: { url: '' } },
    { id: 't3', type: 'text', x: 24, y: 388, w: 342, h: 120, content: { text: 'Certificate ID: CERTIFICATE_ID\nProduct: PRODUCT_NAME\nBatch: BATCH_NO' } }
  ];
}

function sampleCert(id = 'CERTIFICATE_ID') {
  return {
    certificateId: id,
    type: 'unit',
    status: 'VALID',
    issuedAt: new Date().toISOString(),
    product: { name: 'PRODUCT_NAME', code: 'PRODUCT_CODE' },
    batch: { batchNo: 'BATCH_NO' },
    certificateLayout: sampleCertificateLayout(),
    certificateTemplate: { canvasWidth: 390, canvasHeight: 844 }
  };
}

const DEVICE_PRESETS = [
  { id: 'fit', label: 'Fit', kind: 'scale' },
  { id: 'scale-1-2', label: '1:2', kind: 'scale', scale: 0.5 },
  { id: 'scale-1-3', label: '1:3', kind: 'scale', scale: 1 / 3 },
  { id: 'iphone-se', label: 'iPhone SE', kind: 'phone', w: 320, h: 568 },
  { id: 'iphone-8', label: 'iPhone 8', kind: 'phone', w: 375, h: 667 },
  { id: 'iphone-12-mini', label: 'iPhone 12 mini', kind: 'phone', w: 360, h: 780 },
  { id: 'iphone-13-14', label: 'iPhone 13/14', kind: 'phone', w: 390, h: 844 },
  { id: 'iphone-14', label: 'iPhone 14', kind: 'phone', w: 390, h: 844 },
  { id: 'iphone-14-pro', label: 'iPhone 14 Pro', kind: 'phone', w: 393, h: 852 },
  { id: 'iphone-14-pro-max', label: 'iPhone 14 Pro Max', kind: 'phone', w: 430, h: 932 },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', kind: 'phone', w: 393, h: 852 },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', kind: 'phone', w: 430, h: 932 },
  { id: 'pixel-5', label: 'Pixel 5', kind: 'phone', w: 393, h: 851 },
  { id: 'pixel-7', label: 'Pixel 7', kind: 'phone', w: 412, h: 915 },
  { id: 'pixel-8', label: 'Pixel 8', kind: 'phone', w: 412, h: 915 },
  { id: 'pixel-8-pro', label: 'Pixel 8 Pro', kind: 'phone', w: 448, h: 998 },
  { id: 'galaxy-s22', label: 'Galaxy S22', kind: 'phone', w: 360, h: 780 },
  { id: 'galaxy-s23-ultra', label: 'Galaxy S23 Ultra', kind: 'phone', w: 384, h: 854 },
  { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra', kind: 'phone', w: 384, h: 854 },
  { id: 'ipad-mini', label: 'iPad mini', kind: 'phone', w: 768, h: 1024 },
  { id: 'ipad-10-2', label: 'iPad 10.2"', kind: 'phone', w: 810, h: 1080 },
  { id: 'ipad-pro-11', label: 'iPad Pro 11"', kind: 'phone', w: 834, h: 1194 },
  { id: 'ipad-pro-12-9', label: 'iPad Pro 12.9"', kind: 'phone', w: 1024, h: 1366 }
];

export default function CmsCanvasPanel({ viewMode, kind = 'landing', selectedPage, layout, layoutLoaded, setLayout, selectedBlockId, setSelectedBlockId }) {
  const { t } = useT();
  const layoutRef = useRef(layout);

  const [previewCertId, setPreviewCertId] = useState('');
  const [previewEpc, setPreviewEpc] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [devicePresetId, setDevicePresetId] = useState('fit');

  const baseW = 390;
  const baseH = 844;
  const devicePreset = useMemo(() => DEVICE_PRESETS.find((d) => d.id === devicePresetId) || DEVICE_PRESETS[0], [devicePresetId]);
  const scale = useMemo(() => {
    if (!devicePreset) return 1;
    if (Number(devicePreset.scale) > 0) return Math.max(0.1, Math.min(2, Number(devicePreset.scale)));
    if (!devicePreset.w) return 1;
    return Math.max(0.1, Math.min(2, Number(devicePreset.w) / baseW));
  }, [devicePreset]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const setCanvasItems = (updaterOrNext) => {
    const current = layoutRef.current || [];
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(current) : updaterOrNext;
    setLayout(next);
  };

  const hasCertificateBlock = useMemo(() => (Array.isArray(layout) ? layout.some((b) => b?.type === 'certificate') : false), [layout]);

  useEffect(() => {
    if (kind !== 'landing') return;
    if (!selectedPage?.id) return;
    if (!layoutLoaded) return;
    if (hasCertificateBlock) return;
    const cert = { id: makeId('cert'), type: 'certificate', x: 0, y: 0, w: baseW, h: baseH };
    const next = [cert, ...(Array.isArray(layout) ? layout : [])];
    setLayout(next);
    setSelectedBlockId(cert.id);
  }, [baseH, baseW, hasCertificateBlock, kind, layout, layoutLoaded, selectedPage?.id, setLayout, setSelectedBlockId]);

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
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center">
                <div className="text-xs font-semibold text-zinc-800">{t('certificateTitle')}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-zinc-600">Embedded certificate output</div>
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
          <select value={devicePresetId} onChange={(e) => setDevicePresetId(e.target.value)} className="ac-input w-36 rounded-lg px-3 py-2 text-xs font-semibold">
            <optgroup label="Scale">
              {DEVICE_PRESETS.filter((d) => d.kind === 'scale').map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Phone">
              {DEVICE_PRESETS.filter((d) => d.kind === 'phone').map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          </select>
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
          {kind === 'landing' && !hasCertificateBlock ? (
            <button
              type="button"
              onClick={() => {
                const next = [...layout, { id: makeId('cert'), type: 'certificate', x: 0, y: 0, w: baseW, h: baseH }];
                setLayout(next);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              {t('addCertificate')}
            </button>
          ) : null}
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
                <div className="mt-3 text-[11px] font-semibold text-zinc-600">EPC</div>
                <input
                  value={previewEpc}
                  onChange={(e) => setPreviewEpc(e.target.value)}
                  placeholder="EPC_CODE"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-zinc-400"
                />
              </div>
              <button
                type="button"
                className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                onClick={async () => {
                  setPreviewError(null);
                  const id = String(previewCertId || '').trim();
                  const epc = String(previewEpc || '').trim();
                  if (!id && !epc) {
                    setPreviewData(null);
                    return;
                  }
                  try {
                    const base = getPublicApiBaseUrl();
                    const url = id ? `${base}/cert/${encodeURIComponent(id)}` : `${base}/resolve`;
                    const res = await axios.get(url, { params: id ? undefined : { epc } });
                    setPreviewData(res?.data?.data || null);
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
          <div className="overflow-auto bg-white">
            <div className="mx-auto" style={{ width: (devicePreset?.w || baseW), height: (devicePreset?.h || baseH) }}>
              <div style={{ width: baseW * scale, height: baseH * scale }} className="mx-auto">
                <div style={{ width: baseW, height: baseH, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="overflow-auto rounded-xl border border-zinc-200">
                  <PublicRenderer layout={layout} data={previewData || sampleCert()} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <CanvasStage
          width={baseW}
          height={baseH}
          scale={scale}
          items={blocks}
          setItems={setCanvasItems}
          selectedId={selectedBlockId}
          setSelectedId={setSelectedBlockId}
        />
      )}
    </div>
  );
}
