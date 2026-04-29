import React, { useEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../../components/admin/CanvasStage';
import { useT } from '../../i18n/useT';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useMediaStore from '../../store/useMediaStore';
import useRecordsStore from '../../store/useRecordsStore';
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

const DEVICE_PRESETS = [
  { id: 'fit', label: 'Fit', w: null, h: null },
  { id: 'iphone-se', label: 'iPhone SE', w: 320, h: 568 },
  { id: 'iphone-14', label: 'iPhone 14', w: 390, h: 844 },
  { id: 'pixel-7', label: 'Pixel 7', w: 412, h: 915 }
];

export default function AdminCertificateTemplateBuilder({ initialSelectedId = null }) {
  const { t } = useT();
  const { templates, error, fetchTemplates, createTemplate, updateTemplate, deleteTemplate } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    error: s.error,
    fetchTemplates: s.fetchTemplates,
    createTemplate: s.createTemplate,
    updateTemplate: s.updateTemplate,
    deleteTemplate: s.deleteTemplate
  }));
  const { token } = useAdminAuthStore((s) => ({ token: s.token }));
  const { uploadMedia } = useMediaStore((s) => ({ uploadMedia: s.uploadMedia }));
  const { products, fetchProducts, updateProduct } = useRecordsStore((s) => ({
    products: s.products,
    fetchProducts: s.fetchProducts,
    updateProduct: s.updateProduct
  }));

  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newBackground, setNewBackground] = useState('');
  const [newBgUploading, setNewBgUploading] = useState(false);
  const [newBgError, setNewBgError] = useState(null);
  const [newBgFileKey, setNewBgFileKey] = useState(0);
  const [previewId, setPreviewId] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState(null);
  const [bgFileKey, setBgFileKey] = useState(0);
  const [devicePresetId, setDevicePresetId] = useState('fit');
  const [backgroundMode, setBackgroundMode] = useState('background');
  const [assignedProductIds, setAssignedProductIds] = useState(() => new Set());

  const fieldsRef = useRef([]);

  const selected = useMemo(() => templates.find((it) => String(it.id) === String(selectedId)) || null, [templates, selectedId]);
  const canvasW = Number(selected?.canvasWidth) > 0 ? Number(selected.canvasWidth) : 390;
  const canvasH = Number(selected?.canvasHeight) > 0 ? Number(selected.canvasHeight) : 844;
  const devicePreset = useMemo(() => DEVICE_PRESETS.find((d) => d.id === devicePresetId) || DEVICE_PRESETS[0], [devicePresetId]);
  const scale = useMemo(() => {
    if (!devicePreset || !devicePreset.w) return 1;
    return Math.max(0.1, Math.min(2, Number(devicePreset.w) / canvasW));
  }, [canvasW, devicePreset]);

  const fields = useMemo(() => {
    const layout = Array.isArray(selected?.layoutJson) ? selected.layoutJson : [];
    const placeholders = Array.isArray(selected?.placeholders) ? selected.placeholders : [];
    const placeholderByKey = new Map();
    for (const p of placeholders) {
      const key = String(p?.key || '').trim();
      if (!key) continue;
      placeholderByKey.set(key, p);
    }
    const safePreview = previewData
      ? {
          ...previewData,
          templateData: {
            ...(previewData.templateData || {}),
            ...Object.fromEntries(placeholders.map((p) => [String(p?.key || '').trim(), previewData?.templateData?.[String(p?.key || '').trim()] || p?.sample || '']))
          }
        }
      : null;
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
            if (typ === 'rich_text') {
              return <div className="mt-1 text-sm font-semibold text-zinc-900" dangerouslySetInnerHTML={{ __html: val }} />;
            }
            return <div className="mt-1 truncate text-sm font-semibold text-zinc-900">{val}</div>;
          })()}
        </div>
      )
    }));
  }, [selected, previewData]);

  useEffect(() => {
    fieldsRef.current = Array.isArray(selected?.layoutJson) ? selected.layoutJson : [];
  }, [selected]);

  const selectedField = useMemo(() => (fieldsRef.current || []).find((f) => f.id === selectedFieldId) || null, [selectedFieldId]);

  const placeholders = useMemo(() => (Array.isArray(selected?.placeholders) ? selected.placeholders : []), [selected]);

  const updateSelected = async (patch) => {
    if (!selected) return;
    await updateTemplate({ id: selected.id, patch });
  };

  const setFields = async (nextFields) => {
    if (!selected) return;
    const sanitized = (nextFields || []).map((field) => {
      const next = { ...(field || {}) };
      delete next.render;
      return next;
    });
    await updateSelected({ layoutJson: sanitized });
  };

  const setCanvasItems = (updaterOrNext) => {
    const current = fieldsRef.current || [];
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(current) : updaterOrNext;
    void setFields(next);
  };

  const updateField = (patch) => {
    if (!selectedField || !selected) return;
    const current = fieldsRef.current || [];
    void setFields(current.map((f) => (f.id === selectedField.id ? { ...f, ...patch } : f)));
  };

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (initialSelectedId == null) return;
    setSelectedId(initialSelectedId);
    setSelectedFieldId(null);
  }, [initialSelectedId]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (selectedId != null) return;
    if (templates.length > 0) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  useEffect(() => {
    if (!selected?.id) return;
    const next = new Set();
    for (const p of Array.isArray(products) ? products : []) {
      if (String(p?.certificateTemplateId || '') === String(selected.id)) next.add(String(p.id));
    }
    setAssignedProductIds(next);
  }, [products, selected?.id]);

  const fetchPreview = async () => {
    setPreviewError(null);
    setPreviewData(null);
    const certId = String(previewId || '').trim();
    if (!certId) return;
    if (!token) {
      setPreviewError('Not authenticated');
      return;
    }
    try {
      const api = createAdminApi({ token });
      const res = await api.get(`/analytics/cert/${encodeURIComponent(certId)}`);
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
  };

  return (
    <div className="ac-page">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{t('certTplHeading')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('certTplSubheading')}</p>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="ac-card p-3">
          <div className="mb-3 text-xs font-semibold text-zinc-500">{t('certTemplates')}</div>
          <div className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedId(t.id);
                  setSelectedFieldId(null);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  t.id === selectedId ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                <div className="font-semibold">{t.name}</div>
                <div className={`text-[11px] ${t.id === selectedId ? 'text-brand-700/80' : 'text-zinc-500'}`}>
                  {(Array.isArray(t.layoutJson) ? t.layoutJson.length : 0)} fields
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-zinc-50 p-3">
            <div className="text-xs font-semibold text-zinc-700">{t('createTemplate')}</div>
            <div className="mt-2 space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="ac-input rounded-lg px-3 py-2"
                placeholder={t('templateName')}
              />
              <input
                value={newBackground}
                onChange={(e) => setNewBackground(e.target.value)}
                className="ac-input rounded-lg px-3 py-2"
                placeholder={t('backgroundUrl')}
              />
              <input
                key={newBgFileKey}
                type="file"
                accept="image/*,video/*"
                disabled={newBgUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setNewBgError(null);
                  setNewBgUploading(true);
                  try {
                    const created = await uploadMedia({ file });
                    if (created?.url) setNewBackground(created.url);
                    setNewBgFileKey((k) => k + 1);
                  } catch (err) {
                    const msg = err?.response?.data?.message || err?.message || 'Upload failed';
                    setNewBgError(msg);
                  } finally {
                    setNewBgUploading(false);
                  }
                }}
                className="ac-input rounded-lg px-3 py-2"
              />
              {newBgError ? <div className="text-xs text-rose-700">{newBgError}</div> : null}
              <button
                type="button"
                onClick={() => {
                  const nm = String(newName || '').trim();
                  if (!nm) return;
                  void createTemplate({
                    name: nm,
                    background: String(newBackground || '').trim() || '',
                    layoutJson: [
                      { id: makeId('field'), path: 'certificateId', label: t('certificateId'), x: 20, y: 40, w: 350, h: 56 },
                      { id: makeId('field'), path: 'product.name', label: t('product'), x: 20, y: 110, w: 350, h: 56 },
                      { id: makeId('field'), path: 'batch.batchNo', label: t('batch'), x: 20, y: 180, w: 350, h: 56 },
                      { id: makeId('field'), path: 'issuedAt', label: t('issued'), x: 20, y: 250, w: 350, h: 56 },
                      { id: makeId('field'), path: 'status', label: t('status'), x: 20, y: 320, w: 220, h: 56 }
                    ]
                  }).then((created) => {
                    if (created?.id != null) setSelectedId(created.id);
                    setSelectedFieldId(null);
                    setNewName('');
                    setNewBackground('');
                  });
                }}
                className="ac-btn w-full rounded-lg px-3 py-2 text-sm"
              >
                {t('create')}
              </button>
            </div>
          </div>

          {selected ? (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3">
              <div className="text-xs font-semibold text-zinc-700">{t('assignProducts')}</div>
              <div className="mt-2 max-h-56 space-y-1 overflow-auto">
                {(Array.isArray(products) ? products : [])
                  .slice()
                  .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                  .map((p) => {
                    const id = String(p.id);
                    const checked = assignedProductIds.has(id);
                    return (
                      <label key={id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-zinc-800 hover:bg-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(assignedProductIds);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            setAssignedProductIds(next);
                          }}
                        />
                        <span className="truncate">
                          {p.name} <span className="font-mono text-[11px] text-zinc-500">({p.sku})</span>
                        </span>
                      </label>
                    );
                  })}
              </div>
              <button
                type="button"
                className="ac-btn mt-3 w-full rounded-lg px-3 py-2 text-sm"
                onClick={async () => {
                  const list = Array.isArray(products) ? products : [];
                  for (const p of list) {
                    const pid = String(p.id);
                    const shouldHave = assignedProductIds.has(pid);
                    const has = String(p.certificateTemplateId || '') === String(selected.id);
                    if (shouldHave && !has) {
                      await updateProduct({ id: p.id, patch: { certificateTemplateId: Number(selected.id) } });
                    }
                    if (!shouldHave && has) {
                      await updateProduct({ id: p.id, patch: { certificateTemplateId: null } });
                    }
                  }
                  await fetchProducts();
                }}
              >
                {t('apply')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="ac-card p-3">
          {!selected ? (
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('createTemplate')}</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-zinc-500">{t('canvas')}</div>
                  <div className="text-sm font-semibold text-zinc-900">{selected.name}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <input
                      value={previewId}
                      onChange={(e) => setPreviewId(e.target.value)}
                      placeholder={t('certificateId')}
                      className="ac-input w-44 rounded-lg px-3 py-2 text-xs"
                    />
                    <button type="button" onClick={fetchPreview} className="ac-btn ac-btn-soft px-3 py-2 text-xs">
                      {t('preview')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(selected.layoutJson) ? selected.layoutJson : [];
                      void setFields([...current, { id: makeId('field'), path: 'status', label: t('status'), x: 20, y: 400, w: 240, h: 56 }]);
                    }}
                    className="ac-btn ac-btn-soft rounded-lg px-3 py-2 text-xs"
                  >
                    {t('addField')}
                  </button>
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

              {previewError ? <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{previewError}</div> : null}

              <CanvasStage
                width={canvasW}
                height={canvasH}
                scale={scale}
                backgroundMode={backgroundMode}
                backgroundUrl={selected.background || ''}
                items={fields}
                setItems={setCanvasItems}
                selectedId={selectedFieldId}
                setSelectedId={setSelectedFieldId}
                grid={4}
              />
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
                <div className="mb-2 text-xs font-semibold text-zinc-700">{t('placeholders')}</div>
                <div className="space-y-2">
                  {placeholders.map((p, idx) => (
                    <div key={`${p?.key || ''}-${idx}`} className="grid grid-cols-[1fr_1fr_120px_auto] gap-2">
                      <input
                        value={String(p?.key || '')}
                        onChange={(e) => {
                          const next = placeholders.slice();
                          next[idx] = { ...(next[idx] || {}), key: e.target.value };
                          void updateSelected({ placeholders: next });
                        }}
                        placeholder={t('key')}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        value={String(p?.label || '')}
                        onChange={(e) => {
                          const next = placeholders.slice();
                          next[idx] = { ...(next[idx] || {}), label: e.target.value };
                          void updateSelected({ placeholders: next });
                        }}
                        placeholder={t('fieldLabel')}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                      <select
                        value={String(p?.type || 'text')}
                        onChange={(e) => {
                          const next = placeholders.slice();
                          next[idx] = { ...(next[idx] || {}), type: e.target.value };
                          void updateSelected({ placeholders: next });
                        }}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="text">{t('text')}</option>
                        <option value="rich_text">{t('richText')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const next = placeholders.filter((_, i) => i !== idx);
                          void updateSelected({ placeholders: next });
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                      >
                        {t('delete')}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void updateSelected({ placeholders: [...placeholders, { key: '', label: '', type: 'text' }] })}
                  className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  {t('addPlaceholder')}
                </button>
              </div>

              {!selectedField ? (
                <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('selectField')}</div>
              ) : (
                <>
                  <div className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="text-xs font-semibold text-zinc-700">Field</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{selectedField.label || selectedField.path}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-zinc-50 p-2">x: {selectedField.x}</div>
                      <div className="rounded bg-zinc-50 p-2">y: {selectedField.y}</div>
                      <div className="rounded bg-zinc-50 p-2">w: {selectedField.w}</div>
                      <div className="rounded bg-zinc-50 p-2">h: {selectedField.h}</div>
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

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = (fieldsRef.current || []).filter((f) => f.id !== selectedField.id);
                        setSelectedFieldId(null);
                        setFields(next);
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
      </div>
    </div>
  );
}
