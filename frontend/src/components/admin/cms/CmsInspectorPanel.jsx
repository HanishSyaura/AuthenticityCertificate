import React, { useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n/useT';
import useMediaStore from '../../../store/useMediaStore';
import RichTextEditor from '../RichTextEditor';

export default function CmsInspectorPanel({ selectedBlock, layout, setLayout, clearSelection }) {
  const { t } = useT();
  const { uploadMedia } = useMediaStore((s) => ({ uploadMedia: s.uploadMedia }));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const editorRef = useRef(null);

  const textPlaceholders = useMemo(() => {
    return [
      { label: t('certificateId'), value: '{{certificateId}}' },
      { label: 'Status', value: '{{status}}' },
      { label: `${t('product')}: ${t('name')}`, value: '{{product.name}}' },
      { label: `${t('product')}: ${t('code')}`, value: '{{product.code}}' },
      { label: `${t('batch')}: ${t('batchNo')}`, value: '{{batch.batchNo}}' },
      { label: t('netWeight'), value: '{{epcItem.netWeight}}' },
      { label: t('caiqNo'), value: '{{epcItem.caiqNumber}}' },
      { label: t('productionDate'), value: '{{epcItem.productionDate|date}}' }
    ];
  }, [t]);

  const updateSelected = (patch) => {
    if (!selectedBlock) return;
    const next = layout.map((b) => (b.id === selectedBlock.id ? { ...b, ...patch } : b));
    setLayout(next);
  };

  const updateSelectedContent = (contentPatch) => {
    if (!selectedBlock) return;
    updateSelected({ content: { ...(selectedBlock.content || {}), ...contentPatch } });
  };

  const accept = selectedBlock?.type === 'video' ? 'video/*' : selectedBlock?.type === 'image' ? 'image/*' : undefined;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3 text-xs font-semibold text-zinc-500">{t('inspector')}</div>
      {!selectedBlock ? (
        <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('selectBlock')}</div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-700">Block</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">{selectedBlock.type}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-zinc-50 p-2">x: {selectedBlock.x}</div>
              <div className="rounded bg-zinc-50 p-2">y: {selectedBlock.y}</div>
              <div className="rounded bg-zinc-50 p-2">w: {selectedBlock.w}</div>
              <div className="rounded bg-zinc-50 p-2">h: {selectedBlock.h}</div>
            </div>
          </div>

          {selectedBlock.type === 'text' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-700">{t('content')}</label>
              <div className="mt-1">
                <label className="block text-[11px] font-semibold text-zinc-600">{t('insertPlaceholder')}</label>
                <select
                  value=""
                  onChange={(e) => {
                    const token = String(e.target.value || '');
                    if (!token) return;
                    editorRef.current?.insertText?.(token);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{t('selectPlaceholder')}</option>
                  {textPlaceholders.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1">
                <RichTextEditor
                  ref={editorRef}
                  value={selectedBlock.content?.text || ''}
                  onChange={(html) => updateSelectedContent({ text: html })}
                />
              </div>
            </div>
          ) : null}

          {selectedBlock.type === 'container' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">{t('backgroundColor')}</label>
                  <input
                    type="color"
                    value={String(selectedBlock.content?.backgroundColor || '#ffffff')}
                    onChange={(e) => updateSelectedContent({ backgroundColor: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">{t('borderColor')}</label>
                  <input
                    type="color"
                    value={String(selectedBlock.content?.borderColor || '#e4e4e7')}
                    onChange={(e) => updateSelectedContent({ borderColor: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">{t('borderWidth')}</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={Number(selectedBlock.content?.borderWidth ?? 1)}
                    onChange={(e) => updateSelectedContent({ borderWidth: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">{t('borderRadius')}</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={Number(selectedBlock.content?.borderRadius ?? 12)}
                    onChange={(e) => updateSelectedContent({ borderRadius: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('opacity')}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={Number(selectedBlock.content?.opacity ?? 1)}
                  onChange={(e) => updateSelectedContent({ opacity: Number(e.target.value) })}
                  className="mt-2 w-full"
                />
                <div className="mt-1 text-xs text-zinc-500">{Number(selectedBlock.content?.opacity ?? 1).toFixed(2)}</div>
              </div>
            </div>
          ) : null}

          {selectedBlock.type === 'certificate' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('certificateBlockType')}</label>
                <select
                  value={String(selectedBlock.content?.variant || 'auth')}
                  onChange={(e) => updateSelectedContent({ variant: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="auth">{t('authCertificate')}</option>
                  <option value="supporting">{t('supportingCertificate')}</option>
                </select>
              </div>
              {String(selectedBlock.content?.variant || 'auth') === 'supporting' ? (
                <div>
                  <label className="block text-xs font-medium text-zinc-700">{t('supportingIndex')}</label>
                  <input
                    type="number"
                    min={0}
                    value={Number.isFinite(Number(selectedBlock.content?.supportingIndex)) ? Number(selectedBlock.content?.supportingIndex) : 0}
                    onChange={(e) => updateSelectedContent({ supportingIndex: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                  <div className="mt-1 text-[11px] text-zinc-500">{t('supportingIndexHint')}</div>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedBlock.type === 'image' || selectedBlock.type === 'video' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-700">{t('url')}</label>
              <input
                value={selectedBlock.content?.url || ''}
                onChange={(e) => updateSelectedContent({ url: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="https://..."
              />
              {selectedBlock.type === 'image' ? (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-zinc-700">{t('imageMode')}</label>
                  <select
                    value={selectedBlock.content?.mode || 'fit'}
                    onChange={(e) => updateSelectedContent({ mode: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="fit">{t('actualOrFit')}</option>
                    <option value="stretch">{t('stretch')}</option>
                  </select>
                </div>
              ) : null}
              <div className="mt-2">
                <label className="block text-xs font-medium text-zinc-700">{t('file')}</label>
                <input
                  key={fileKey}
                  type="file"
                  accept={accept}
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadError(null);
                    setUploading(true);
                    try {
                      const created = await uploadMedia({ file });
                      if (created?.url) updateSelectedContent({ url: created.url });
                      setFileKey((k) => k + 1);
                    } catch (err) {
                      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
                      setUploadError(msg);
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                {uploadError ? <div className="mt-2 text-xs text-rose-700">{uploadError}</div> : null}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = layout.filter((b) => b.id !== selectedBlock.id);
                clearSelection();
                setLayout(next);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              {t('delete')}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = layout.map((b) => (b.id === selectedBlock.id ? { ...b, x: 20, y: 20 } : b));
                setLayout(next);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              {t('resetPosition')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
