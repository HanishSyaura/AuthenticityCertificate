import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../../components/admin/CanvasStage';
import RichTextEditor from '../../components/admin/RichTextEditor';
import { useT } from '../../i18n/useT';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useMediaStore from '../../store/useMediaStore';
import useEpcStore from '../../store/useEpcStore';
import { createAdminApi } from '../../utils/adminApi';

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function getValue(path, data) {
  const parts = String(path).split('.');
  let cur = data;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return cur ?? '';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const DEVICE_PRESETS = [
  { id: 'fit', label: 'Fit', w: null, h: null },
  { id: 'iphone-se', label: 'iPhone SE', w: 320, h: 568 },
  { id: 'iphone-14', label: 'iPhone 14', w: 390, h: 844 },
  { id: 'pixel-7', label: 'Pixel 7', w: 412, h: 915 }
];

export default function AdminCertificateTemplateBuilder({ initialSelectedId = null }) {
  const { t } = useT();
  const { templates, error, fetchTemplates, updateTemplate, deleteTemplate } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    error: s.error,
    fetchTemplates: s.fetchTemplates,
    updateTemplate: s.updateTemplate,
    deleteTemplate: s.deleteTemplate
  }));
  const { token } = useAdminAuthStore((s) => ({ token: s.token }));
  const { uploadMedia } = useMediaStore((s) => ({ uploadMedia: s.uploadMedia }));
  const { batches, fetchBatches, updateBatch } = useEpcStore((s) => ({
    batches: s.batches,
    fetchBatches: s.fetchBatches,
    updateBatch: s.updateBatch
  }));

  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [previewId, setPreviewId] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState(null);
  const [bgFileKey, setBgFileKey] = useState(0);
  const [wizardStep, setWizardStep] = useState('fields');
  const [addOverlayKey, setAddOverlayKey] = useState('');
  const [devicePresetId, setDevicePresetId] = useState('fit');
  const [backgroundMode, setBackgroundMode] = useState('background');
  const [assignedBatchIds, setAssignedBatchIds] = useState(() => new Set());
  const [draftPlaceholders, setDraftPlaceholders] = useState([]);
  const [draftLayout, setDraftLayout] = useState([]);
  const persistTimerRef = useRef(null);
  const pendingPatchRef = useRef(null);
  const previewNowRef = useRef(new Date().toISOString());

  const selected = useMemo(() => templates.find((it) => String(it.id) === String(selectedId)) || null, [templates, selectedId]);
  const canvasW = Number(selected?.canvasWidth) > 0 ? Number(selected.canvasWidth) : 390;
  const canvasH = Number(selected?.canvasHeight) > 0 ? Number(selected.canvasHeight) : 844;
  const canvasBgColor = String(selected?.backgroundColor || '#ffffff');
  const devicePreset = useMemo(() => DEVICE_PRESETS.find((d) => d.id === devicePresetId) || DEVICE_PRESETS[0], [devicePresetId]);
  const scale = useMemo(() => {
    if (!devicePreset || !devicePreset.w) return 1;
    return Math.max(0.1, Math.min(2, Number(devicePreset.w) / canvasW));
  }, [canvasW, devicePreset]);

  const placeholders = useMemo(() => (Array.isArray(draftPlaceholders) ? draftPlaceholders : []), [draftPlaceholders]);

  const placeholderByKey = useMemo(() => {
    const map = new Map();
    for (const p of Array.isArray(placeholders) ? placeholders : []) {
      const key = String(p?.key || '').trim();
      if (!key) continue;
      map.set(key, p);
    }
    return map;
  }, [placeholders]);

  const textAlignClass = (align) => {
    const a = String(align || '').toLowerCase();
    if (a === 'center') return 'text-center';
    if (a === 'right') return 'text-right';
    return 'text-left';
  };

  const safePreview = useMemo(() => {
    const list = Array.isArray(placeholders) ? placeholders : [];
    const templateData = {};
    for (const p of list) {
      const key = String(p?.key || '').trim();
      if (!key) continue;
      const fromCert = previewData?.templateData?.[key];
      const fromSample = p?.sample;
      const fromStatic = String(p?.source || '') === 'static' ? p?.staticValue : '';
      templateData[key] = fromCert ?? fromSample ?? fromStatic ?? '';
    }
    const fallback = {
      certificateId: `CERT-${String(previewId || '').trim() || '0001'}`,
      status: 'valid',
      issuedAt: previewNowRef.current,
      product: {
        name: 'Sample Product',
        sku: 'SKU-001',
        code: 'CODE-001',
        category: '',
        origin: '',
        description: ''
      },
      batch: {
        batchNo: 'BATCH-001'
      }
    };
    const base = previewData
      ? {
          ...fallback,
          ...previewData,
          product: { ...fallback.product, ...(previewData.product || {}) },
          batch: { ...fallback.batch, ...(previewData.batch || {}) }
        }
      : fallback;
    return { ...base, templateData: { ...(base.templateData || {}), ...templateData } };
  }, [placeholders, previewData, previewId]);

  const canvasItems = useMemo(() => {
    const layout = Array.isArray(draftLayout) ? draftLayout : [];
    return layout.map((f) => ({
      ...(f || {}),
      render: (it) => (
        <div className="h-full w-full p-2">
          <div className="text-[11px] font-semibold text-zinc-600">{it.label || it.path}</div>
          {(() => {
            const raw = safePreview ? getValue(it.path, safePreview) : '';
            const path = String(it.path || '');
            const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
            const ph = key ? placeholderByKey.get(key) : null;
            const typ = String(ph?.type || '');
            const val = raw == null ? '' : String(raw);
            const fs = Number(it.fontSize) > 0 ? Number(it.fontSize) : 14;
            const align = textAlignClass(it.align);
            if (typ === 'rich_text') {
              return (
                <div
                  className={`mt-1 font-semibold text-zinc-900 ${align}`}
                  style={{ fontSize: fs }}
                  dangerouslySetInnerHTML={{ __html: val }}
                />
              );
            }
            return (
              <div className={`mt-1 truncate font-semibold text-zinc-900 ${align}`} style={{ fontSize: fs }}>
                {val}
              </div>
            );
          })()}
        </div>
      )
    }));
  }, [draftLayout, placeholderByKey, safePreview]);

  const previewItems = useMemo(() => {
    const layout = Array.isArray(draftLayout) ? draftLayout : [];
    return layout.map((f) => ({
      ...(f || {}),
      render: (it) => {
        const raw = safePreview ? getValue(it.path, safePreview) : '';
        const path = String(it.path || '');
        const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
        const ph = key ? placeholderByKey.get(key) : null;
        const typ = String(ph?.type || '');
        const val = raw == null ? '' : String(raw);
        const fs = Number(it.fontSize) > 0 ? Number(it.fontSize) : 14;
        const align = textAlignClass(it.align);
        if (typ === 'rich_text') {
          return <div className={`h-full w-full ${align}`} style={{ fontSize: fs }} dangerouslySetInnerHTML={{ __html: val }} />;
        }
        return (
          <div className={`h-full w-full whitespace-pre-wrap break-words font-semibold text-zinc-900 ${align}`} style={{ fontSize: fs }}>
            {val}
          </div>
        );
      }
    }));
  }, [draftLayout, placeholderByKey, safePreview]);

  const selectedField = useMemo(() => (Array.isArray(draftLayout) ? draftLayout : []).find((f) => f.id === selectedFieldId) || null, [draftLayout, selectedFieldId]);

  useEffect(() => {
    if (!selected?.id) return;
    setDraftPlaceholders(Array.isArray(selected?.placeholders) ? selected.placeholders : []);
    setDraftLayout(Array.isArray(selected?.layoutJson) ? selected.layoutJson : []);
    pendingPatchRef.current = null;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
  }, [selected?.id, selected?.layoutJson, selected?.placeholders]);

  const queueTemplatePatch = (patch) => {
    if (!selected?.id) return;
    pendingPatchRef.current = { ...(pendingPatchRef.current || {}), ...(patch || {}) };
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      const toSend = pendingPatchRef.current;
      pendingPatchRef.current = null;
      if (!toSend) return;
      void updateTemplate({ id: selected.id, patch: toSend });
    }, 350);
  };

  const updateSelected = async (patch) => {
    if (!selected) return;
    await updateTemplate({ id: selected.id, patch });
  };

  const addCanvasItemForKey = (key) => {
    if (!selected) return;
    const k = String(key || '').trim();
    if (!k) return;
    const ph = placeholders.find((p) => String(p?.key || '').trim() === k) || null;
    const label = String(ph?.label || k).trim() || k;
    const item = { id: makeId('field'), path: `templateData.${k}`, label, x: 20, y: 40, w: 240, h: 56, fontSize: 14, align: 'left' };
    const nextLayout = [...(Array.isArray(draftLayout) ? draftLayout : []), item];
    setDraftLayout(nextLayout);
    queueTemplatePatch({ layoutJson: nextLayout });
    setSelectedFieldId(item.id);
  };

  const sanitizeLayout = (nextFields) =>
    (nextFields || []).map((field) => {
      const next = { ...(field || {}) };
      delete next.render;
      return next;
    });

  const setCanvasItems = (updaterOrNext) => {
    const current = Array.isArray(draftLayout) ? draftLayout : [];
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(current) : updaterOrNext;
    const sanitized = sanitizeLayout(next);
    setDraftLayout(sanitized);
    queueTemplatePatch({ layoutJson: sanitized });
  };

  const updateField = (patch) => {
    if (!selectedField || !selected) return;
    const minW = 40;
    const minH = 30;
    const nextLayout = (Array.isArray(draftLayout) ? draftLayout : []).map((f) => {
      if (f.id !== selectedField.id) return f;
      const merged = { ...f, ...(patch || {}) };
      const w = clamp(Number(merged.w) || minW, minW, Math.max(minW, canvasW - (Number(merged.x) || 0)));
      const h = clamp(Number(merged.h) || minH, minH, Math.max(minH, canvasH - (Number(merged.y) || 0)));
      const x = clamp(Number(merged.x) || 0, 0, Math.max(0, canvasW - w));
      const y = clamp(Number(merged.y) || 0, 0, Math.max(0, canvasH - h));
      return { ...merged, x, y, w, h };
    });
    setDraftLayout(nextLayout);
    queueTemplatePatch({ layoutJson: nextLayout });
  };

  const replacePlaceholders = (next) => {
    const arr = Array.isArray(next) ? next : [];
    setDraftPlaceholders(arr);
    queueTemplatePatch({ placeholders: arr });
  };

  const replacePlaceholdersAndLayout = ({ nextPlaceholders, nextLayout }) => {
    const ph = Array.isArray(nextPlaceholders) ? nextPlaceholders : [];
    const ly = Array.isArray(nextLayout) ? nextLayout : [];
    setDraftPlaceholders(ph);
    setDraftLayout(ly);
    queueTemplatePatch({ placeholders: ph, layoutJson: ly });
  };

  const validatePlaceholders = useMemo(() => {
    const list = Array.isArray(placeholders) ? placeholders : [];
    const errors = [];
    const seen = new Set();
    for (let i = 0; i < list.length; i += 1) {
      const p = list[i] || {};
      const key = String(p.key || '').trim();
      const label = String(p.label || '').trim();
      const source = String(p.source || 'manual');
      const bindPath = String(p.bindPath || '').trim();
      if (!key) errors.push(`${t('key')} #${i + 1}: required`);
      if (key && !/^[a-zA-Z0-9_]+$/.test(key)) errors.push(`${t('key')} "${key}": invalid`);
      const norm = key.toLowerCase();
      if (key && seen.has(norm)) errors.push(`${t('key')} "${key}": duplicate`);
      if (key) seen.add(norm);
      if (!label) errors.push(`${t('fieldLabel')} #${i + 1}: required`);
      if (source === 'product' && !bindPath) errors.push(`${t('bindTo')} #${i + 1}: required`);
    }
    return { ok: errors.length === 0, errors };
  }, [placeholders, t]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (initialSelectedId == null) return;
    setSelectedId(initialSelectedId);
    setSelectedFieldId(null);
  }, [initialSelectedId]);

  useEffect(() => {
    void fetchBatches({ limit: 200, offset: 0 });
  }, [fetchBatches]);

  useEffect(() => {
    if (selectedId != null) return;
    if (templates.length > 0) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  useEffect(() => {
    if (!selected?.id) return;
    setWizardStep('fields');
    setSelectedFieldId(null);
    const firstKey = String((Array.isArray(selected.placeholders) ? selected.placeholders : [])?.[0]?.key || '').trim();
    setAddOverlayKey(firstKey);
  }, [selected?.id]);

  useEffect(() => {
    const keys = (Array.isArray(placeholders) ? placeholders : [])
      .map((p) => String(p?.key || '').trim())
      .filter((k) => k);
    if (keys.length === 0) {
      if (addOverlayKey) setAddOverlayKey('');
      return;
    }
    const cur = String(addOverlayKey || '').trim();
    if (!cur || !keys.includes(cur)) setAddOverlayKey(keys[0]);
  }, [placeholders, addOverlayKey]);

  useEffect(() => {
    if (!selected?.id) return;
    const next = new Set();
    for (const b of Array.isArray(batches) ? batches : []) {
      if (String(b?.certificateTemplateId || '') === String(selected.id)) next.add(String(b.id));
    }
    setAssignedBatchIds(next);
  }, [batches, selected?.id]);

  const fetchPreview = useCallback(async (certId) => {
    setPreviewError(null);
    setPreviewData(null);
    const id = String(certId || '').trim();
    if (!id) return;
    if (!token) {
      setPreviewError('Not authenticated');
      return;
    }
    try {
      const api = createAdminApi({ token });
      const res = await api.get(`/analytics/cert/${encodeURIComponent(id)}`);
      const cert = res?.data?.data?.certificate || null;
      if (!cert) {
        setPreviewError(t('notFound'));
        return;
      }
      setPreviewData(cert);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || t('verificationFailed');
      setPreviewError(msg);
    }
  }, [t, token]);

  useEffect(() => {
    const certId = String(previewId || '').trim();
    if (!certId) {
      setPreviewError(null);
      setPreviewData(null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!alive) return;
        await fetchPreview(certId);
      })();
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [fetchPreview, previewId]);

  return (
    <div className="ac-page">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{t('certTplHeading')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('certTplSubheading')}</p>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,540px)_minmax(0,420px)_minmax(0,420px)]">
        <div className="ac-card p-3">
          {!selected ? (
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('selectTemplate')}</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-zinc-500">{t('canvas')}</div>
                  <div className="text-sm font-semibold text-zinc-900">{selected.name}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setWizardStep('fields')}
                      className={`px-3 py-2 text-xs font-semibold ${wizardStep === 'fields' ? 'bg-brand-50 text-brand-800' : 'text-zinc-700 hover:bg-zinc-50'}`}
                    >
                      {t('step1DefineFields')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!validatePlaceholders.ok) return;
                        setWizardStep('canvas');
                      }}
                      disabled={!validatePlaceholders.ok}
                      className={`px-3 py-2 text-xs font-semibold ${wizardStep === 'canvas' ? 'bg-brand-50 text-brand-800' : 'text-zinc-700 hover:bg-zinc-50'}`}
                    >
                      {t('step2PlaceCanvas')}
                    </button>
                  </div>
                  {wizardStep === 'canvas' ? (
                    <>
                      <select
                        value={devicePresetId}
                        onChange={(e) => setDevicePresetId(e.target.value)}
                        className="ac-input w-36 rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        {DEVICE_PRESETS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <select value={addOverlayKey} onChange={(e) => setAddOverlayKey(e.target.value)} className="ac-input w-52 rounded-lg px-3 py-2 text-xs">
                        <option value="">{t('selectDataField')}</option>
                        {placeholders
                          .map((p) => ({ key: String(p?.key || '').trim(), label: String(p?.label || '').trim() }))
                          .filter((p) => p.key)
                          .map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label || p.key}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addCanvasItemForKey(addOverlayKey)}
                        className="ac-btn ac-btn-soft rounded-lg px-3 py-2 text-xs"
                        disabled={!String(addOverlayKey || '').trim()}
                      >
                        {t('addToCanvas')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWizardStep('fields')}
                        className="ac-btn ac-btn-soft rounded-lg px-3 py-2 text-xs"
                      >
                        {t('editFields')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWizardStep('canvas')}
                      className="ac-btn ac-btn-soft rounded-lg px-3 py-2 text-xs"
                      disabled={!validatePlaceholders.ok}
                    >
                      {t('nextStep')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(t('confirmDelete'))) return;
                      await deleteTemplate({ id: selected.id });
                      setSelectedId(null);
                      setSelectedFieldId(null);
                    }}
                    className="ac-btn ac-btn-soft rounded-lg px-3 py-2 text-xs"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>

              {wizardStep === 'fields' && !validatePlaceholders.ok && validatePlaceholders.errors.length > 0 ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  {validatePlaceholders.errors[0]}
                </div>
              ) : null}

              {wizardStep === 'canvas' ? (
                <CanvasStage
                  width={canvasW}
                  height={canvasH}
                  scale={scale}
                  backgroundMode={backgroundMode}
                  backgroundColor={canvasBgColor}
                  backgroundUrl={selected.background || ''}
                  items={canvasItems}
                  setItems={setCanvasItems}
                  selectedId={selectedFieldId}
                  setSelectedId={setSelectedFieldId}
                  grid={4}
                />
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="text-xs font-semibold text-zinc-700">{t('step1DefineFields')}</div>
                  <div className="mt-2 text-sm text-zinc-600">{t('wizardFieldsHint')}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {t('dataFields')}: {placeholders.length}
                  </div>
                  <div className="mt-3 space-y-2">
                    {placeholders.map((p, idx) => {
                      const key = String(p?.key || '');
                      const type = String(p?.type || 'text');
                      const source = String(p?.source || 'manual');
                      return (
                        <div key={`${p?.key || ''}-${idx}`} className="rounded-lg border border-zinc-200 bg-white p-2">
                          <div className="grid grid-cols-1 gap-2">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <input
                                value={key}
                                onChange={(e) => {
                                  const nextKey = e.target.value;
                                  const oldKey = String(placeholders[idx]?.key || '');
                                  const nextPlaceholders = placeholders.slice();
                                  nextPlaceholders[idx] = { ...(nextPlaceholders[idx] || {}), key: nextKey };
                                  const oldTrim = String(oldKey || '').trim();
                                  const newTrim = String(nextKey || '').trim();
                                  if (oldTrim && newTrim && oldTrim !== newTrim) {
                                    const nextLayout = (Array.isArray(draftLayout) ? draftLayout : []).map((it) => {
                                      const path = String(it?.path || '');
                                      return path === `templateData.${oldTrim}` ? { ...it, path: `templateData.${newTrim}` } : it;
                                    });
                                    if (String(addOverlayKey || '').trim() === oldTrim) setAddOverlayKey(newTrim);
                                    replacePlaceholdersAndLayout({ nextPlaceholders, nextLayout });
                                    return;
                                  }
                                  replacePlaceholders(nextPlaceholders);
                                }}
                                placeholder={t('key')}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                              />
                              <input
                                value={String(p?.label || '')}
                                onChange={(e) => {
                                  const next = placeholders.slice();
                                  next[idx] = { ...(next[idx] || {}), label: e.target.value };
                                  replacePlaceholders(next);
                                }}
                                placeholder={t('fieldLabel')}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <select
                                value={type}
                                onChange={(e) => {
                                  const next = placeholders.slice();
                                  next[idx] = { ...(next[idx] || {}), type: e.target.value };
                                  replacePlaceholders(next);
                                }}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                              >
                                <option value="text">{t('text')}</option>
                                <option value="rich_text">{t('richText')}</option>
                              </select>
                              <select
                                value={source}
                                onChange={(e) => {
                                  const next = placeholders.slice();
                                  next[idx] = { ...(next[idx] || {}), source: e.target.value };
                                  replacePlaceholders(next);
                                }}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                              >
                                <option value="manual">{t('sourceManual')}</option>
                                <option value="product">{t('sourceProduct')}</option>
                                <option value="static">{t('sourceStatic')}</option>
                              </select>
                              <select
                                value={String(p?.bindPath || '')}
                                onChange={(e) => {
                                  const next = placeholders.slice();
                                  next[idx] = { ...(next[idx] || {}), bindPath: e.target.value };
                                  replacePlaceholders(next);
                                }}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                              >
                                <option value="">{t('bindTo')}</option>
                                <option value="product.name">product.name</option>
                                <option value="product.sku">product.sku</option>
                                <option value="product.code">product.code</option>
                                <option value="product.category">product.category</option>
                                <option value="product.origin">product.origin</option>
                                <option value="product.description">product.description</option>
                              </select>
                            </div>
                            {type === 'rich_text' ? (
                              <div>
                                <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('staticValue')}</div>
                                <RichTextEditor
                                  value={String(p?.staticValue || '')}
                                  onChange={(v) => {
                                    const next = placeholders.slice();
                                    next[idx] = { ...(next[idx] || {}), staticValue: v };
                                    replacePlaceholders(next);
                                  }}
                                />
                              </div>
                            ) : (
                              <input
                                value={String(p?.staticValue || '')}
                                onChange={(e) => {
                                  const next = placeholders.slice();
                                  next[idx] = { ...(next[idx] || {}), staticValue: e.target.value };
                                  replacePlaceholders(next);
                                }}
                                placeholder={t('staticValue')}
                                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                              />
                            )}
                            <input
                              value={String(p?.help || '')}
                              onChange={(e) => {
                                const next = placeholders.slice();
                                next[idx] = { ...(next[idx] || {}), help: e.target.value };
                                replacePlaceholders(next);
                              }}
                              placeholder={t('helpText')}
                              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const oldKeyTrim = String(placeholders[idx]?.key || '').trim();
                                  const nextPlaceholders = placeholders.filter((_, i) => i !== idx);
                                  if (oldKeyTrim) {
                                    const nextLayout = (Array.isArray(draftLayout) ? draftLayout : []).filter((it) => String(it?.path || '') !== `templateData.${oldKeyTrim}`);
                                    if (String(addOverlayKey || '').trim() === oldKeyTrim) setAddOverlayKey('');
                                    if (selectedField && String(selectedField.path || '') === `templateData.${oldKeyTrim}`) setSelectedFieldId(null);
                                    replacePlaceholdersAndLayout({ nextPlaceholders, nextLayout });
                                    return;
                                  }
                                  replacePlaceholders(nextPlaceholders);
                                }}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                              >
                                {t('delete')}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        replacePlaceholders([
                          ...placeholders,
                          { key: '', label: '', type: 'text', source: 'manual', bindPath: '', staticValue: '', help: '', sample: '' }
                        ])
                      }
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      {t('addPlaceholder')}
                    </button>
                    <button type="button" onClick={() => setWizardStep('canvas')} className="ac-btn rounded-lg px-3 py-2 text-xs" disabled={!validatePlaceholders.ok}>
                      {t('nextStep')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="mb-3 text-xs font-semibold text-zinc-500">{t('inspector')}</div>
          {!selected ? null : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('templateName')}</label>
                <input
                  value={selected.name}
                  onChange={(e) => void updateSelected({ name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('backgroundUrl')}</label>
                <input
                  value={selected.background || ''}
                  onChange={(e) => void updateSelected({ background: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                <div className="mt-2">
                  <label className="block text-xs font-medium text-zinc-700">{t('backgroundColor')}</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={canvasBgColor}
                      onChange={(e) => void updateSelected({ backgroundColor: e.target.value })}
                      className="h-10 w-14 rounded border border-zinc-200 bg-white p-1"
                    />
                    <input
                      value={canvasBgColor}
                      onChange={(e) => void updateSelected({ backgroundColor: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-zinc-700">{t('backgroundMode')}</label>
                  <select
                    value={backgroundMode}
                    onChange={(e) => setBackgroundMode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="background">{t('stretchBackground')}</option>
                    <option value="actual">{t('actualSize')}</option>
                  </select>
                  <div className="mt-1 text-[11px] text-zinc-500">{t('backgroundSizeAdvice')}</div>
                </div>
                <input
                  key={bgFileKey}
                  type="file"
                  accept="image/*,video/*"
                  disabled={bgUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBgError(null);
                    setBgUploading(true);
                    try {
                      const created = await uploadMedia({ file });
                      if (created?.url) await updateSelected({ background: created.url });
                      setBgFileKey((k) => k + 1);
                    } catch (err) {
                      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
                      setBgError(msg);
                    } finally {
                      setBgUploading(false);
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                {bgError ? <div className="mt-2 text-xs text-rose-700">{bgError}</div> : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">{t('canvasWidth')}</label>
                  <input
                    type="number"
                    min={240}
                    max={1200}
                    value={canvasW}
                    onChange={(e) => void updateSelected({ canvasWidth: Number(e.target.value) || 390 })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">{t('canvasHeight')}</label>
                  <input
                    type="number"
                    min={240}
                    max={2400}
                    value={canvasH}
                    onChange={(e) => void updateSelected({ canvasHeight: Number(e.target.value) || 844 })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="mb-2 text-xs font-semibold text-zinc-700">{t('assignEpcBatches')}</div>
                <div className="max-h-56 space-y-1 overflow-auto">
                  {(Array.isArray(batches) ? batches : []).map((b) => {
                    const id = String(b.id);
                    const checked = assignedBatchIds.has(id);
                    const title = String(b.batchName || `#${b.id}`);
                    const sku = String(b.sku || b?.product?.sku || '');
                    return (
                      <label key={id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(assignedBatchIds);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            setAssignedBatchIds(next);
                          }}
                        />
                        <span className="min-w-0 truncate">
                          {title} {sku ? <span className="font-mono text-[11px] text-zinc-500">({sku})</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="ac-btn mt-3 w-full rounded-lg px-3 py-2 text-sm"
                  onClick={async () => {
                    const list = Array.isArray(batches) ? batches : [];
                    for (const b of list) {
                      const bid = String(b.id);
                      const shouldHave = assignedBatchIds.has(bid);
                      const has = String(b.certificateTemplateId || '') === String(selected.id);
                      if (shouldHave && !has) await updateBatch({ batchId: b.id, patch: { certificateTemplateId: Number(selected.id) } });
                      if (!shouldHave && has) await updateBatch({ batchId: b.id, patch: { certificateTemplateId: null } });
                    }
                    await fetchBatches({ limit: 200, offset: 0 });
                  }}
                >
                  {t('apply')}
                </button>
              </div>

              {!selectedField ? (
                <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('selectField')}</div>
              ) : (
                <>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="text-xs font-semibold text-zinc-700">Field</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{selectedField.label || selectedField.path}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600">x</label>
                        <input
                          type="number"
                          value={Number(selectedField.x) || 0}
                          onChange={(e) => updateField({ x: Number(e.target.value) || 0 })}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600">y</label>
                        <input
                          type="number"
                          value={Number(selectedField.y) || 0}
                          onChange={(e) => updateField({ y: Number(e.target.value) || 0 })}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600">w</label>
                        <input
                          type="number"
                          value={Number(selectedField.w) || 0}
                          onChange={(e) => updateField({ w: Number(e.target.value) || 0 })}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600">h</label>
                        <input
                          type="number"
                          value={Number(selectedField.h) || 0}
                          onChange={(e) => updateField({ h: Number(e.target.value) || 0 })}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700">{t('fieldLabel')}</label>
                    <input
                      value={selectedField.label || ''}
                      onChange={(e) => updateField({ label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700">{t('dataPath')}</label>
                    <select
                      value={selectedField.path}
                      onChange={(e) => updateField({ path: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="certificateId">certificateId</option>
                      <option value="product.name">product.name</option>
                      <option value="batch.batchNo">batch.batchNo</option>
                      <option value="issuedAt">issuedAt</option>
                      <option value="status">status</option>
                      {placeholders
                        .map((p) => String(p?.key || '').trim())
                        .filter(Boolean)
                        .map((k) => (
                          <option key={k} value={`templateData.${k}`}>
                            templateData.{k}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">{t('fontSize')}</label>
                      <input
                        type="number"
                        min={8}
                        max={96}
                        value={Number(selectedField.fontSize) > 0 ? Number(selectedField.fontSize) : 14}
                        onChange={(e) => updateField({ fontSize: Number(e.target.value) || 14 })}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">{t('align')}</label>
                      <select
                        value={String(selectedField.align || 'left')}
                        onChange={(e) => updateField({ align: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="left">{t('alignLeft')}</option>
                        <option value="center">{t('alignCenter')}</option>
                        <option value="right">{t('alignRight')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = (Array.isArray(draftLayout) ? draftLayout : []).filter((f) => f.id !== selectedField.id);
                        setSelectedFieldId(null);
                        setDraftLayout(next);
                        queueTemplatePatch({ layoutJson: next });
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="mb-3 text-xs font-semibold text-zinc-500">{t('preview')}</div>
          {!selected ? null : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('certificateId')}</label>
                <input
                  value={previewId}
                  onChange={(e) => setPreviewId(e.target.value)}
                  placeholder={t('certificateId')}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              {previewError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{previewError}</div> : null}
              <CanvasStage
                mode="preview"
                width={canvasW}
                height={canvasH}
                scale={Math.max(0.1, Math.min(1, 360 / canvasW))}
                backgroundMode={backgroundMode}
                backgroundColor={canvasBgColor}
                backgroundUrl={selected.background || ''}
                items={previewItems}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
