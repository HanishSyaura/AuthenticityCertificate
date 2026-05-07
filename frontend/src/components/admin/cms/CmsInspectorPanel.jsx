import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n/useT';
import useUploadsStore from '../../../store/useUploadsStore';
import { isFileTooLarge, MAX_UPLOAD_MB } from '../../../utils/uploadLimits';
import RichTextEditor from '../RichTextEditor';
import ImageCropModal from './ImageCropModal';

export default function CmsInspectorPanel({ selectedBlock, layout, setLayout, clearSelection, templates, layoutLocked = false }) {
  const { t } = useT();
  const { uploadMedia } = useUploadsStore((s) => ({ uploadMedia: s.uploadMedia }));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [cropBlockId, setCropBlockId] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);
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

  const selectedIndex = useMemo(() => {
    if (!selectedBlock?.id) return -1;
    const arr = Array.isArray(layout) ? layout : [];
    return arr.findIndex((b) => b && b.id === selectedBlock.id);
  }, [layout, selectedBlock?.id]);

  const onReorderLayer = useCallback(
    (action) => {
      if (!selectedBlock?.id) return;
      const arr = Array.isArray(layout) ? layout : [];
      const idx = arr.findIndex((b) => b && b.id === selectedBlock.id);
      if (idx < 0) return;

      let next = arr;
      if (action === 'toBack') {
        if (idx === 0) return;
        next = [arr[idx], ...arr.slice(0, idx), ...arr.slice(idx + 1)];
      } else if (action === 'toFront') {
        if (idx === arr.length - 1) return;
        next = [...arr.slice(0, idx), ...arr.slice(idx + 1), arr[idx]];
      } else if (action === 'backward') {
        if (idx === 0) return;
        next = arr.slice();
        const tmp = next[idx - 1];
        next[idx - 1] = next[idx];
        next[idx] = tmp;
      } else if (action === 'forward') {
        if (idx === arr.length - 1) return;
        next = arr.slice();
        const tmp = next[idx + 1];
        next[idx + 1] = next[idx];
        next[idx] = tmp;
      } else {
        return;
      }

      setLayout(next);
    },
    [layout, selectedBlock?.id, setLayout]
  );

  const updateBlockContentById = useCallback(
    (blockId, contentPatch) => {
      if (!blockId) return;
      const next = layout.map((b) => (b.id === blockId ? { ...b, content: { ...(b.content || {}), ...contentPatch } } : b));
      setLayout(next);
    },
    [layout, setLayout]
  );

  const updateSelectedContent = (contentPatch) => {
    if (!selectedBlock) return;
    updateBlockContentById(selectedBlock.id, contentPatch);
  };

  const accept = selectedBlock?.type === 'video' ? 'video/*' : selectedBlock?.type === 'image' ? 'image/*' : undefined;

  const doUpload = useCallback(
    async (file, blockId) => {
      setUploadError(null);
      setUploading(true);
      try {
        const created = await uploadMedia({ file });
        if (created?.url) updateBlockContentById(blockId, { url: created.url });
        setFileKey((k) => k + 1);
        return created;
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Upload failed';
        setUploadError(msg);
        throw new Error(msg);
      } finally {
        setUploading(false);
      }
    },
    [updateBlockContentById, uploadMedia]
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3 text-xs font-semibold text-zinc-500">{t('inspector')}</div>
      {!selectedBlock ? (
        <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('selectBlock')}</div>
      ) : (
        <div className="space-y-3">
          {layoutLocked ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{t('translateOnlyHint')}</div>
          ) : null}
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-700">Block</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">{selectedBlock.type}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-zinc-50 p-2">x: {selectedBlock.x}</div>
              <div className="rounded bg-zinc-50 p-2">y: {selectedBlock.y}</div>
              <div className="rounded bg-zinc-50 p-2">w: {selectedBlock.w}</div>
              <div className="rounded bg-zinc-50 p-2">h: {selectedBlock.h}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onReorderLayer('toBack')}
                disabled={layoutLocked || selectedIndex <= 0}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('sendToBack')}
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer('toFront')}
                disabled={layoutLocked || selectedIndex < 0 || selectedIndex >= (Array.isArray(layout) ? layout.length - 1 : 0)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('bringToFront')}
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer('backward')}
                disabled={layoutLocked || selectedIndex <= 0}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('sendBackward')}
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer('forward')}
                disabled={layoutLocked || selectedIndex < 0 || selectedIndex >= (Array.isArray(layout) ? layout.length - 1 : 0)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('bringForward')}
              </button>
            </div>
          </div>

          {selectedBlock.type === 'text' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-700">{t('content')}</label>
              {!layoutLocked ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600">{t('fontSize')}</label>
                    <input
                      type="number"
                      min={8}
                      max={96}
                      value={Number(selectedBlock.content?.fontSize) > 0 ? Number(selectedBlock.content.fontSize) : 14}
                      onChange={(e) => updateSelectedContent({ fontSize: Number(e.target.value) || 14 })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600">{t('fontColor')}</label>
                    <input
                      type="color"
                      value={String(selectedBlock.content?.fontColor || '#18181b')}
                      onChange={(e) => updateSelectedContent({ fontColor: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                    />
                  </div>
                </div>
              ) : null}
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

          {!layoutLocked && selectedBlock.type === 'container' ? (
            <div className="space-y-3">
              {(() => {
                const fill = String(selectedBlock.content?.backgroundFill || 'solid');
                const bg = String(selectedBlock.content?.backgroundColor || '#ffffff');
                const from = String(selectedBlock.content?.gradientFrom || bg || '#ffffff');
                const to = String(selectedBlock.content?.gradientTo || '#ffffff');
                const angle = Number(selectedBlock.content?.gradientAngle ?? 180);
                const nextAngle = Number.isFinite(angle) ? Math.max(0, Math.min(360, angle)) : 180;
                return (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">{t('backgroundFill')}</label>
                      <select
                        value={fill}
                        onChange={(e) => {
                          const v = String(e.target.value || 'solid');
                          if (v === 'gradient') {
                            updateSelectedContent({
                              backgroundFill: 'gradient',
                              gradientFrom: from,
                              gradientTo: to,
                              gradientAngle: nextAngle
                            });
                            return;
                          }
                          updateSelectedContent({ backgroundFill: 'solid', backgroundColor: bg || from || '#ffffff' });
                        }}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="solid">{t('solid')}</option>
                        <option value="gradient">{t('gradient')}</option>
                      </select>
                    </div>

                    {fill === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700">{t('gradientFrom')}</label>
                          <input
                            type="color"
                            value={from}
                            onChange={(e) => updateSelectedContent({ gradientFrom: e.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700">{t('gradientTo')}</label>
                          <input
                            type="color"
                            value={to}
                            onChange={(e) => updateSelectedContent({ gradientTo: e.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700">{t('backgroundColor')}</label>
                        <input
                          type="color"
                          value={bg}
                          onChange={(e) => updateSelectedContent({ backgroundColor: e.target.value })}
                          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                        />
                      </div>
                    )}

                    {fill === 'gradient' ? (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700">{t('gradientAngle')}</label>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={1}
                          value={nextAngle}
                          onChange={(e) => updateSelectedContent({ gradientAngle: Number(e.target.value) })}
                          className="mt-2 w-full"
                        />
                        <div className="mt-1 text-xs text-zinc-500">{nextAngle}°</div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('borderColor')}</label>
                <input
                  type="color"
                  value={String(selectedBlock.content?.borderColor || '#e4e4e7')}
                  onChange={(e) => updateSelectedContent({ borderColor: e.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                />
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

          {!layoutLocked && selectedBlock.type === 'certificate' ? (
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
                  <label className="block text-xs font-medium text-zinc-700">{t('certTemplate')}</label>
                  <select
                    value={selectedBlock.content?.certificateTemplateId != null ? String(selectedBlock.content.certificateTemplateId) : ''}
                    onChange={(e) => updateSelectedContent({ certificateTemplateId: e.target.value ? Number(e.target.value) : null })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{t('none')}</option>
                    {(Array.isArray(templates) ? templates : []).map((tpl) => (
                      <option key={tpl.id} value={String(tpl.id)}>
                        {String(tpl?.certificateId || '').trim() ? `${tpl.certificateId} — ${tpl.name}` : tpl.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {!layoutLocked && (selectedBlock.type === 'image' || selectedBlock.type === 'video') ? (
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
                    setFileKey((k) => k + 1);
                    if (isFileTooLarge(file)) {
                      setUploadError(`File too large. Maximum file size is ${MAX_UPLOAD_MB}MB.`);
                      return;
                    }
                    if (selectedBlock.type === 'image') {
                      setCropFile(file);
                      setCropBlockId(selectedBlock.id);
                      setCropOpen(true);
                      return;
                    }
                    await doUpload(file, selectedBlock.id);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                <div className="mt-1 text-[11px] text-zinc-500">Max file size: {MAX_UPLOAD_MB}MB</div>
                {uploadError ? <div className="mt-2 text-xs text-rose-700">{uploadError}</div> : null}
                {selectedBlock.type === 'image' && String(selectedBlock.content?.url || '').trim() ? (
                  <button
                    type="button"
                    disabled={uploading || cropLoading}
                    onClick={async () => {
                      const rawUrl = String(selectedBlock.content?.url || '').trim();
                      if (!rawUrl) return;
                      setUploadError(null);
                      setCropLoading(true);
                      try {
                        const abs = new URL(rawUrl, window.location.origin).toString();
                        const res = await fetch(abs, { credentials: 'include' });
                        if (!res.ok) throw new Error(`Failed to load image (${res.status})`);
                        const blob = await res.blob();
                        const name = decodeURIComponent(abs.split('/').pop() || 'image');
                        const f = new File([blob], name, { type: blob.type || 'image/jpeg', lastModified: Date.now() });
                        setCropFile(f);
                        setCropBlockId(selectedBlock.id);
                        setCropOpen(true);
                      } catch (err) {
                        const msg = err?.message || 'Failed to load image';
                        setUploadError(msg);
                      } finally {
                        setCropLoading(false);
                      }
                    }}
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {cropLoading ? t('loading') : t('cropImage')}
                  </button>
                ) : null}
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
              disabled={layoutLocked}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            >
              {t('delete')}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = layout.map((b) => (b.id === selectedBlock.id ? { ...b, x: 20, y: 20 } : b));
                setLayout(next);
              }}
              disabled={layoutLocked}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            >
              {t('resetPosition')}
            </button>
          </div>
        </div>
      )}
      <ImageCropModal
        open={cropOpen}
        file={cropFile}
        onClose={() => {
          setCropOpen(false);
          setCropFile(null);
          setCropBlockId(null);
        }}
        onUseOriginal={async (file) => {
          if (!cropBlockId) return;
          await doUpload(file, cropBlockId);
          setCropOpen(false);
          setCropFile(null);
          setCropBlockId(null);
        }}
        onConfirm={async (file) => {
          if (!cropBlockId) return;
          await doUpload(file, cropBlockId);
          setCropOpen(false);
          setCropFile(null);
          setCropBlockId(null);
        }}
      />
    </div>
  );
}
