import React, { useEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../../components/admin/CanvasStage';
import { ADMIN_KEYS } from '../../utils/adminKeys';
import { readJson, writeJson } from '../../utils/storage';
import { useT } from '../../i18n/useT';

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

const SAMPLE_DATA = {
  certificateId: 'BN-TEST-123',
  status: 'VALID',
  issuedAt: new Date().toISOString(),
  product: { name: 'Premium Bird Nest (Gold Edition)' },
  batch: { batchNo: 'BATCH-2024-04' }
};

function getValue(path) {
  const parts = String(path).split('.');
  let cur = SAMPLE_DATA;
  for (const p of parts) {
    cur = cur?.[p];
  }
  if (path === 'issuedAt') return new Date(SAMPLE_DATA.issuedAt).toLocaleDateString();
  return cur ?? '';
}

function getTemplates() {
  const all = readJson(ADMIN_KEYS.certTemplates, []);
  return Array.isArray(all) ? all : [];
}

function saveTemplates(next) {
  writeJson(ADMIN_KEYS.certTemplates, next);
}

export default function AdminCertificateTemplateBuilder() {
  const { t } = useT();
  const [templates, setTemplates] = useState(getTemplates());
  const [selectedId, setSelectedId] = useState(templates[0]?.id || null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [newName, setNewName] = useState('Default Certificate');

  const fieldsRef = useRef([]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId]
  );

  const fields = useMemo(() => {
    return (selected?.fields || []).map((f) => ({
      ...f,
      render: (it) => (
        <div className="h-full w-full p-2">
          <div className="text-[11px] font-semibold text-zinc-600">{it.label || it.path}</div>
          <div className="mt-1 truncate text-sm font-semibold text-zinc-900">{getValue(it.path)}</div>
        </div>
      )
    }));
  }, [selected]);

  useEffect(() => {
    fieldsRef.current = selected?.fields || [];
  }, [selected]);

  const selectedField = useMemo(
    () => (selected?.fields || []).find((f) => f.id === selectedFieldId) || null,
    [selected, selectedFieldId]
  );

  const updateSelected = (patch) => {
    if (!selected) return;
    const nextTemplates = templates.map((t) => (t.id === selected.id ? { ...t, ...patch } : t));
    setTemplates(nextTemplates);
    saveTemplates(nextTemplates);
  };

  const setFields = (nextFields) => {
    const sanitized = (nextFields || []).map((field) => {
      const next = { ...(field || {}) };
      delete next.render;
      return next;
    });
    updateSelected({ fields: sanitized });
  };

  const setCanvasItems = (updaterOrNext) => {
    const current = fieldsRef.current || [];
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(current) : updaterOrNext;
    setFields(next);
  };

  const updateField = (patch) => {
    if (!selectedField || !selected) return;
    setFields(selected.fields.map((f) => (f.id === selectedField.id ? { ...f, ...patch } : f)));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{t('certTplHeading')}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t('certTplSubheading')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
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
                  t.id === selectedId ? 'bg-zinc-900 text-white' : 'text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                <div className="font-semibold">{t.name}</div>
                <div className={`text-[11px] ${t.id === selectedId ? 'text-white/70' : 'text-zinc-500'}`}>
                  {t.fields?.length || 0} fields
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
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const next = {
                    id: makeId('tpl'),
                    name: newName,
                    width: 920,
                    height: 640,
                    backgroundUrl:
                      'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=elegant%20certificate%20background%2C%20minimal%2C%20gold%20accent%2C%20paper%20texture&image_size=landscape_4_3',
                    fields: [
                      { id: makeId('field'), path: 'certificateId', label: 'Certificate ID', x: 80, y: 110, w: 300, h: 60 },
                      { id: makeId('field'), path: 'product.name', label: 'Product', x: 80, y: 190, w: 520, h: 60 },
                      { id: makeId('field'), path: 'batch.batchNo', label: 'Batch', x: 80, y: 270, w: 300, h: 60 },
                      { id: makeId('field'), path: 'issuedAt', label: 'Issued', x: 80, y: 350, w: 300, h: 60 }
                    ]
                  };
                  const updated = [next, ...templates];
                  setTemplates(updated);
                  saveTemplates(updated);
                  setSelectedId(next.id);
                  setSelectedFieldId(null);
                }}
                className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3">
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
                  <button
                    type="button"
                    onClick={() => {
                      const next = [
                        ...selected.fields,
                        { id: makeId('field'), path: 'status', label: 'Status', x: 80, y: 430, w: 240, h: 60 }
                      ];
                      setFields(next);
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                  >
                    {t('addField')}
                  </button>
                </div>
              </div>

              <CanvasStage
                width={selected.width}
                height={selected.height}
                backgroundUrl={selected.backgroundUrl}
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
                  onChange={(e) => updateSelected({ name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('backgroundUrl')}</label>
                <input
                  value={selected.backgroundUrl || ''}
                  onChange={(e) => updateSelected({ backgroundUrl: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
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
