import React, { useEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../../components/admin/CanvasStage';
import { useT } from '../../i18n/useT';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import useMediaStore from '../../store/useMediaStore';
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

export default function AdminCertificateTemplateBuilder() {
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

  const [selectedId, setSelectedId] = useState(null);
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

  const fieldsRef = useRef([]);

  const selected = useMemo(() => templates.find((it) => String(it.id) === String(selectedId)) || null, [templates, selectedId]);

  const fields = useMemo(() => {
    const layout = Array.isArray(selected?.layoutJson) ? selected.layoutJson : [];
    return layout.map((f) => ({
      ...(f || {}),
      render: (it) => (
        <div className="h-full w-full p-2">
          <div className="text-[11px] font-semibold text-zinc-600">{it.label || it.path}</div>
          <div className="mt-1 truncate text-sm font-semibold text-zinc-900">
            {previewData ? String(getValue(it.path, previewData)) : ''}
          </div>
        </div>
      )
    }));
  }, [selected, previewData]);

  useEffect(() => {
    fieldsRef.current = Array.isArray(selected?.layoutJson) ? selected.layoutJson : [];
  }, [selected]);

  const selectedField = useMemo(() => (fieldsRef.current || []).find((f) => f.id === selectedFieldId) || null, [selectedFieldId]);

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
    if (selectedId != null) return;
    if (templates.length > 0) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

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
                accept="image/*"
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
                      { id: makeId('field'), path: 'certificateId', label: t('certificateId'), x: 80, y: 110, w: 300, h: 60 },
                      { id: makeId('field'), path: 'product.name', label: t('product'), x: 80, y: 190, w: 520, h: 60 },
                      { id: makeId('field'), path: 'batch.batchNo', label: t('batch'), x: 80, y: 270, w: 300, h: 60 },
                      { id: makeId('field'), path: 'issuedAt', label: t('issued'), x: 80, y: 350, w: 300, h: 60 },
                      { id: makeId('field'), path: 'status', label: t('status'), x: 80, y: 430, w: 240, h: 60 }
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
                      void setFields([...current, { id: makeId('field'), path: 'status', label: t('status'), x: 80, y: 430, w: 240, h: 60 }]);
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
                width={920}
                height={640}
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
                <input
                  key={bgFileKey}
                  type="file"
                  accept="image/*"
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
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = selected.fields.filter((f) => f.id !== selectedField.id);
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
