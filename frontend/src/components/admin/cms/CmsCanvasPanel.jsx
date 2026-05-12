import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../CanvasStage';
import PublicRenderer from '../../PublicRenderer';
import { useT } from '../../../i18n/useT';
import axios from 'axios';
import { getPublicApiBaseUrl } from '../../../utils/apiBase';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { createAdminApi } from '../../../utils/adminApi';

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function stripHtmlToText(input) {
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

function getSupportingTemplateIdsFromLayout(layout) {
  const ids = [];
  const arr = Array.isArray(layout) ? layout : [];
  for (const b of arr) {
    if (!b || b.type !== 'certificate') continue;
    const variant = String(b?.content?.variant || 'auth');
    if (variant !== 'supporting') continue;
    const rawId = b?.content?.certificateTemplateId;
    const id = rawId == null ? NaN : Number(rawId);
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  return Array.from(new Set(ids));
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

function PreviewStage({
  compact = false,
  baseW,
  frameH,
  viewportW,
  viewportH,
  scale,
  effectivePreviewLayout,
  previewData,
  previewLoading,
  previewError,
  previewEpc,
  t
}) {
  const scrollRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const scrollbarOutside = 16;
  const outsidePx = (Number(scale) > 0 ? Number(scale) : 1) * scrollbarOutside;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
    const nextTop = Math.max(0, Math.min(maxScroll, Number(lastScrollTopRef.current) || 0));
    if (Math.abs((el.scrollTop || 0) - nextTop) > 1) el.scrollTop = nextTop;
  }, [effectivePreviewLayout, previewData, scale]);

  return (
    <div className={`w-full overflow-auto ${compact ? 'p-2' : 'p-3'}`}>
      <div className="mx-auto" style={{ width: viewportW + outsidePx, height: viewportH }}>
        <div
          className="relative rounded-xl border border-zinc-200 shadow-sm"
          style={{ width: baseW, height: frameH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <div
            ref={scrollRef}
            onScroll={(e) => {
              lastScrollTopRef.current = e.currentTarget.scrollTop || 0;
            }}
            className="ac-scrollbar-outside"
          >
            <PublicRenderer layout={effectivePreviewLayout} data={previewData || sampleCert()} />
          </div>
          {previewLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-xs font-semibold text-zinc-700">{t('loading')}</div>
          ) : null}
          {previewError ? (
            <div className="absolute left-2 right-2 top-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">{previewError}</div>
          ) : null}
          {!previewLoading && !previewError && previewEpc ? (
            <div className="absolute bottom-2 left-2 rounded-lg border border-zinc-200 bg-white/80 px-2 py-1 text-[11px] font-mono text-zinc-700">{previewEpc}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function CmsCanvasPanel({ viewMode, kind = 'landing', selectedPage, layout, previewLayout, setLayout, selectedBlockId, setSelectedBlockId, layoutLocked = false }) {
  const { t } = useT();
  const safeLayout = useMemo(() => (Array.isArray(layout) ? layout.filter((b) => b && typeof b === 'object') : []), [layout]);
  const layoutRef = useRef(safeLayout);
  const supportingTplCacheRef = useRef(new Map());

  const [previewEpc, setPreviewEpc] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [devicePresetId, setDevicePresetId] = useState('fit');
  const token = useAdminAuthStore((s) => s.token);

  const baseW = 390;
  const baseH = 844;
  const devicePreset = useMemo(() => DEVICE_PRESETS.find((d) => d.id === devicePresetId) || DEVICE_PRESETS[0], [devicePresetId]);
  const scale = useMemo(() => {
    if (!devicePreset) return 1;
    if (Number(devicePreset.scale) > 0) return Math.max(0.1, Math.min(2, Number(devicePreset.scale)));
    if (!devicePreset.w) return 1;
    return Math.max(0.1, Math.min(2, Number(devicePreset.w) / baseW));
  }, [devicePreset]);
  const viewportW = useMemo(() => {
    if (Number(devicePreset?.w) > 0) return Number(devicePreset.w);
    return baseW * scale;
  }, [devicePreset, scale]);
  const viewportH = useMemo(() => {
    if (Number(devicePreset?.h) > 0) return Number(devicePreset.h);
    return baseH * scale;
  }, [devicePreset, scale]);
  const frameH = useMemo(() => {
    const h = Number(devicePreset?.h);
    if (!Number.isFinite(h) || h <= 0) return baseH;
    const unscaled = h / scale;
    if (!Number.isFinite(unscaled) || unscaled <= 0) return baseH;
    return Math.max(80, Math.min(baseH, unscaled));
  }, [devicePreset, scale]);

  const effectivePreviewLayout = useMemo(() => {
    return Array.isArray(previewLayout) && previewLayout.length ? previewLayout : layout;
  }, [layout, previewLayout]);

  useEffect(() => {
    if (viewMode !== 'preview' && viewMode !== 'split') return;
    if (!token) return;
    let alive = true;
    setPreviewLoading(true);
    setPreviewError(null);
    const run = async () => {
      try {
        const api = createAdminApi({ token });
        const res = await api.get('/epc/items', { params: { limit: 1, offset: 0 } });
        const epc = res?.data?.data?.items?.[0]?.epcCode ? String(res.data.data.items[0].epcCode) : '';
        if (!alive) return;
        setPreviewEpc(epc);
        if (!epc) {
          setPreviewData(null);
          return;
        }
        const base = getPublicApiBaseUrl();
        const out = await axios.get(`${base}/resolve`, { params: { epc } });
        if (!alive) return;
        setPreviewData(out?.data?.data || null);
      } catch (e) {
        if (!alive) return;
        const msg = e?.response?.data?.message || e?.message || t('failedToLoadCertificate');
        setPreviewData(null);
        setPreviewError(msg);
      } finally {
        if (alive) setPreviewLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [t, token, viewMode]);

  useEffect(() => {
    if (viewMode !== 'preview' && viewMode !== 'split') return;
    if (!token) return;
    const ids = getSupportingTemplateIdsFromLayout(effectivePreviewLayout);
    if (!ids.length) return;
    let alive = true;
    const run = async () => {
      try {
        const api = createAdminApi({ token });
        const cache = supportingTplCacheRef.current;
        const missing = ids.filter((id) => !cache.has(id));
        if (missing.length) {
          const results = await Promise.allSettled(missing.map((id) => api.get(`/templates/${id}`)));
          for (let i = 0; i < results.length; i += 1) {
            const r = results[i];
            const id = missing[i];
            if (r.status === 'fulfilled') {
              const tpl = r.value?.data?.data || null;
              if (tpl) cache.set(id, tpl);
            }
          }
        }
        if (!alive) return;
        const fetched = ids.map((id) => cache.get(id)).filter(Boolean);
        if (!fetched.length) return;
        setPreviewData((prev) => {
          if (!prev) return prev;
          const existing = Array.isArray(prev?.supportingTemplates) ? prev.supportingTemplates : [];
          const byId = new Map(existing.map((t) => [Number(t?.id), t]));
          for (const tpl of fetched) {
            const tid = Number(tpl?.id);
            if (Number.isFinite(tid) && tid > 0) byId.set(tid, tpl);
          }
          return { ...prev, supportingTemplates: Array.from(byId.values()) };
        });
      } catch (e) {
        void e;
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [effectivePreviewLayout, token, viewMode]);

  useEffect(() => {
    layoutRef.current = safeLayout;
  }, [safeLayout]);

  const setCanvasItems = (updaterOrNext) => {
    const current = layoutRef.current || [];
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(current) : updaterOrNext;
    setLayout(next);
  };

  const hasAuthCertificateBlock = useMemo(() => {
    return safeLayout.some((b) => {
      if (b?.type !== 'certificate') return false;
      const variant = String(b?.content?.variant || 'auth');
      return variant === 'auth';
    });
  }, [safeLayout]);

  const blocks = useMemo(() => {
    return safeLayout.map((b) => ({
      ...(b || {}),
      render: (it) => {
        if (it.type === 'container') {
          const fill = String(it.content?.backgroundFill || 'solid');
          const bg = String(it.content?.backgroundColor || '#ffffff');
          const from = String(it.content?.gradientFrom || bg || '#ffffff');
          const to = String(it.content?.gradientTo || '#ffffff');
          const angleRaw = Number(it.content?.gradientAngle ?? 180);
          const angle = Number.isFinite(angleRaw) ? Math.max(0, Math.min(360, angleRaw)) : 180;
          const borderColor = String(it.content?.borderColor || '#e4e4e7');
          const borderWidth = Number(it.content?.borderWidth ?? 1);
          const radius = Number(it.content?.borderRadius ?? 12);
          const opacity = Math.max(0, Math.min(1, Number(it.content?.opacity ?? 1)));
          return (
            <div className="h-full w-full p-2">
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  backgroundColor: fill === 'gradient' ? undefined : bg,
                  backgroundImage: fill === 'gradient' ? `linear-gradient(${angle}deg, ${from}, ${to})` : undefined,
                  borderColor,
                  borderWidth: Number.isFinite(borderWidth) ? borderWidth : 1,
                  borderStyle: 'solid',
                  borderRadius: Number.isFinite(radius) ? radius : 12,
                  opacity
                }}
              >
                <div className="rounded bg-white/70 px-2 py-1 text-xs font-semibold text-zinc-800">{t('container')}</div>
              </div>
            </div>
          );
        }
        if (it.type === 'text') {
          const preview = stripHtmlToText(it.content?.text || '');
          const fs = Number(it.content?.fontSize) > 0 ? Number(it.content.fontSize) : 14;
          const color = String(it.content?.fontColor || '').trim() || '#18181b';
          return (
            <div className="h-full w-full p-2">
              <div className="whitespace-pre-wrap" style={{ fontSize: `${fs}px`, lineHeight: 1.2, color }}>
                {preview || ''}
              </div>
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
              <div className="text-xs font-semibold text-zinc-800">{t('video')}</div>
              <div className="mt-1 text-xs text-zinc-600 break-all">{it.content?.url || t('url')}</div>
            </div>
          );
        }
        if (it.type === 'certificate') {
          const variant = String(it.content?.variant || 'auth');
          return (
            <div className="flex h-full w-full items-center justify-center p-2">
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center">
                <div className="text-xs font-semibold text-zinc-800">{t('certificateTitle')}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-zinc-600">
                  {variant === 'supporting' ? t('supportingCertificate') : t('authCertificate')}
                </div>
              </div>
            </div>
          );
        }
        if (it.type === 'supporting_document') {
          const docType = String(it.content?.docType || '').trim();
          const label =
            docType === 'moh_health_certificate'
              ? t('mohHealthCertificate')
              : docType === 'export_permit'
                ? t('exportPermit')
                : docType === 'dvs_health_certificate'
                  ? t('dvsHealthCertificate')
                  : docType === 'dvs_coo_certificate'
                    ? t('dvsCooCertificate')
                    : t('supportingCertificates');
          return (
            <div className="flex h-full w-full items-center justify-center p-2">
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center">
                <div className="text-xs font-semibold text-zinc-800">{t('supportingDocument')}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-zinc-600">{label}</div>
              </div>
            </div>
          );
        }
        return (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">{t('unknown')}</div>
        );
      }
    }));
  }, [safeLayout, t]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-zinc-500">{t('canvas')}</div>
          <div className="text-sm font-semibold text-zinc-900">{selectedPage ? selectedPage.name : t('selectPage')}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={devicePresetId} onChange={(e) => setDevicePresetId(e.target.value)} className="ac-input w-36 rounded-lg px-3 py-2 text-xs font-semibold">
            <optgroup label={t('scaleGroup')}>
              {DEVICE_PRESETS.filter((d) => d.kind === 'scale').map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('phoneGroup')}>
              {DEVICE_PRESETS.filter((d) => d.kind === 'phone').map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          </select>
          {!layoutLocked ? (
            <>
              <button
                type="button"
                onClick={() => {
                  const next = [
                    ...safeLayout,
                    {
                      id: makeId('container'),
                      type: 'container',
                      x: 20,
                      y: 20,
                      w: 260,
                      h: 120,
                      content: { backgroundColor: '#ffffff', borderColor: '#e4e4e7', borderWidth: 1, borderRadius: 16, opacity: 1 }
                    },
                  ];
                  setLayout(next);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                {t('addContainer')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = [
                    ...safeLayout,
                    { id: makeId('text'), type: 'text', x: 20, y: 20, w: 240, h: 80, content: { text: 'New text', fontSize: 14, fontColor: '#18181b' } }
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
                    ...safeLayout,
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
                  const next = [...safeLayout, { id: makeId('video'), type: 'video', x: 20, y: 300, w: 260, h: 80, content: { url: '' } }];
                  setLayout(next);
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                {t('addVideo')}
              </button>
              {kind === 'landing' && !hasAuthCertificateBlock ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...safeLayout, { id: makeId('cert'), type: 'certificate', x: 0, y: 0, w: baseW, h: baseH, content: { variant: 'auth' } }];
                    setLayout(next);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  {t('addAuthCertificate')}
                </button>
              ) : null}
              {kind === 'landing' ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = [
                      ...safeLayout,
                      {
                        id: makeId('supporting-cert'),
                        type: 'certificate',
                        x: 20,
                        y: 20,
                        w: baseW - 40,
                        h: 260,
                        content: { variant: 'supporting', certificateTemplateId: null }
                      }
                    ];
                    setLayout(next);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  {t('addSupportingCertificate')}
                </button>
              ) : null}
              {kind === 'landing' ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = [
                      ...safeLayout,
                      {
                        id: makeId('supporting-doc'),
                        type: 'supporting_document',
                        x: 20,
                        y: 120,
                        w: 170,
                        h: 240,
                        content: {
                          docType: 'moh_health_certificate',
                          label: '',
                          backgroundColor: '#ffffff',
                          borderColor: '#e4e4e7',
                          borderWidth: 1,
                          borderRadius: 16,
                          opacity: 1
                        }
                      }
                    ];
                    setLayout(next);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  {t('addSupportingDocument')}
                </button>
              ) : null}
              {kind === 'landing' ? (
                <button
                  type="button"
                  onClick={() => {
                    const items = [
                      { docType: 'moh_health_certificate', x: 20, y: 120 },
                      { docType: 'export_permit', x: 200, y: 120 },
                      { docType: 'dvs_health_certificate', x: 20, y: 370 },
                      { docType: 'dvs_coo_certificate', x: 200, y: 370 }
                    ];
                    const next = [
                      ...safeLayout,
                      ...items.map((it) => ({
                        id: makeId('supporting-doc'),
                        type: 'supporting_document',
                        x: it.x,
                        y: it.y,
                        w: 170,
                        h: 240,
                        content: {
                          docType: it.docType,
                          label: '',
                          backgroundColor: '#ffffff',
                          borderColor: '#e4e4e7',
                          borderWidth: 1,
                          borderRadius: 16,
                          opacity: 1
                        }
                      }))
                    ];
                    setLayout(next);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  {t('addSupportingDocuments4')}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {viewMode === 'preview' ? (
        <PreviewStage
          baseW={baseW}
          baseH={baseH}
          frameH={frameH}
          viewportW={viewportW}
          viewportH={viewportH}
          scale={scale}
          effectivePreviewLayout={effectivePreviewLayout}
          previewData={previewData}
          previewLoading={previewLoading}
          previewError={previewError}
          previewEpc={previewEpc}
          t={t}
        />
      ) : viewMode === 'split' ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <CanvasStage
              width={baseW}
              height={baseH}
              scale={scale}
              mode={layoutLocked ? 'select' : 'edit'}
              items={blocks}
              setItems={setCanvasItems}
              selectedId={selectedBlockId}
              setSelectedId={setSelectedBlockId}
            />
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <PreviewStage
              compact
              baseW={baseW}
              baseH={baseH}
              frameH={frameH}
              viewportW={viewportW}
              viewportH={viewportH}
              scale={scale}
              effectivePreviewLayout={effectivePreviewLayout}
              previewData={previewData}
              previewLoading={previewLoading}
              previewError={previewError}
              previewEpc={previewEpc}
              t={t}
            />
          </div>
        </div>
      ) : (
        <CanvasStage
          width={baseW}
          height={baseH}
          scale={scale}
          mode={layoutLocked ? 'select' : 'edit'}
          items={blocks}
          setItems={setCanvasItems}
          selectedId={selectedBlockId}
          setSelectedId={setSelectedBlockId}
        />
      )}
    </div>
  );
}
