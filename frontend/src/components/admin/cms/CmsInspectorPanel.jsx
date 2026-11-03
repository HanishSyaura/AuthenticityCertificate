import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n/useT';
import useUploadsStore from '../../../store/useUploadsStore';
import { isFileTooLarge, MAX_UPLOAD_MB } from '../../../utils/uploadLimits';
import { normalizePublicMediaPath, resolvePublicMediaUrl } from '../../../utils/apiBase';
import RichTextEditor from '../RichTextEditor';
import ImageCropModal from './ImageCropModal';
import { CMS_ICON_OPTIONS } from '../../CmsIcon';
import CmsIcon from '../../CmsIcon';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function snap(n, grid) {
  if (!grid) return n;
  return Math.round(n / grid) * grid;
}

function normalizeCmsBlockUrl(blockType, rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (blockType === 'video') {
    if (/^(?:\/+)?https?:\/\//i.test(raw)) {
      return raw.replace(/^\/+(?=https?:\/\/)/i, '');
    }
    if (/^(?:www\.)?(?:youtube\.com|m\.youtube\.com|youtu\.be|vimeo\.com)\//i.test(raw)) {
      return `https://${raw}`;
    }
    if (/^player\.vimeo\.com\//i.test(raw)) {
      return `https://${raw}`;
    }
  }
  return normalizePublicMediaPath(raw);
}

export default function CmsInspectorPanel({
  selectedBlock,
  layout,
  setLayout,
  clearSelection,
  templates,
  supportingDocumentTypes = [],
  layoutLocked = false,
  canvasWidth = 390,
  canvasHeight = 844,
  grid = 4,
  onCollapse
}) {
  const { t } = useT();
  const { uploadMedia } = useUploadsStore((s) => ({ uploadMedia: s.uploadMedia }));
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(null);
  const [uploadPct, setUploadPct] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [cropBlockId, setCropBlockId] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);
  const editorRef = useRef(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState('layout');
  const [iconPickerSearch, setIconPickerSearch] = useState('');
  const [iconPickerLibrary, setIconPickerLibrary] = useState('all');
  const [iconPickerLimit, setIconPickerLimit] = useState(120);

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

  const alignSelectedToPage = useCallback(
    ({ hAlign, vAlign }) => {
      if (layoutLocked) return;
      if (!selectedBlock?.id) return;
      const cw = Number(canvasWidth) > 0 ? Number(canvasWidth) : 390;
      const ch = Number(canvasHeight) > 0 ? Number(canvasHeight) : 844;
      const w = Number(selectedBlock.w) || 0;
      const h = Number(selectedBlock.h) || 0;
      let x = Number(selectedBlock.x) || 0;
      let y = Number(selectedBlock.y) || 0;

      const ha = hAlign ? String(hAlign) : null;
      const va = vAlign ? String(vAlign) : null;

      if (ha === 'left') x = 0;
      else if (ha === 'center') x = (cw - w) / 2;
      else if (ha === 'right') x = cw - w;

      if (va === 'top') y = 0;
      else if (va === 'middle') y = (ch - h) / 2;
      else if (va === 'bottom') y = ch - h;

      const maxX = Math.max(0, cw - w);
      const maxY = Math.max(0, ch - h);
      x = clamp(snap(x, grid), 0, maxX);
      y = clamp(snap(y, grid), 0, maxY);

      const next = (Array.isArray(layout) ? layout : []).map((b) => (b.id === selectedBlock.id ? { ...b, x, y } : b));
      setLayout(next);
    },
    [canvasHeight, canvasWidth, grid, layout, layoutLocked, selectedBlock?.h, selectedBlock?.id, selectedBlock?.w, selectedBlock?.x, selectedBlock?.y, setLayout]
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

  const guessPosterUrl = useCallback((uploadUrl) => {
    const s = String(uploadUrl || '').trim();
    const m = s.match(/^(\/uploads\/media\/\d+\/)([^/?#]+)\.mp4$/i);
    return m ? `${m[1]}${m[2]}-poster.jpg` : '';
  }, []);

  const doUpload = useCallback(
    async (file, blockId) => {
      setUploadError(null);
      setUploadPhase('uploading');
      setUploadPct(0);
      setUploading(true);
      try {
        const created = await uploadMedia({
          file,
          onProgress: ({ percent }) => {
            if (!Number.isFinite(percent)) return;
            const p = clamp(Math.round(percent), 0, 100);
            setUploadPct(p);
            setUploadPhase(p >= 100 ? 'processing' : 'uploading');
          }
        });
        if (created?.url) {
          const blockType = layout.find((b) => String(b?.id) === String(blockId))?.type || '';
          const patch = { url: normalizePublicMediaPath(created.url) };
          if (blockType === 'video') {
            const poster = String(created?.posterUrl || '').trim() || guessPosterUrl(created.url);
            if (poster) patch.posterUrl = normalizePublicMediaPath(poster);
          }
          updateBlockContentById(blockId, patch);
        }
        setFileKey((k) => k + 1);
        return created;
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || t('uploadFailed');
        setUploadError(msg);
        throw new Error(msg);
      } finally {
        setUploading(false);
        setUploadPhase(null);
        setUploadPct(null);
      }
    },
    [guessPosterUrl, layout, t, updateBlockContentById, uploadMedia]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{t('inspector')}</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">{selectedBlock ? selectedBlock.type : t('selectBlock')}</div>
        </div>
        {typeof onCollapse === 'function' ? (
          <button
            type="button"
            onClick={() => onCollapse()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title={t('collapse')}
          >
            <span>{t('collapse')}</span>
            <span aria-hidden="true">{'>'}</span>
          </button>
        ) : null}
      </div>
      {!selectedBlock ? (
        <div className="rounded-[18px] border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-700">{t('selectBlock')}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {layoutLocked ? (
            <div className="mb-2 shrink-0 rounded-[18px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{t('translateOnlyHint')}</div>
          ) : null}
          <div className="mb-3 grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setActiveInspectorTab('layout')}
              aria-pressed={activeInspectorTab === 'layout'}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeInspectorTab === 'layout' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:bg-white/70'}`}
            >
              Layout
            </button>
            <button
              type="button"
              onClick={() => setActiveInspectorTab('properties')}
              aria-pressed={activeInspectorTab === 'properties'}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeInspectorTab === 'properties' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:bg-white/70'}`}
            >
              Properties
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className={`${activeInspectorTab === 'layout' ? '' : 'hidden'} rounded-[18px] border border-zinc-200 bg-zinc-50/70 p-3`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{t('block')}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">{selectedBlock.type}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { key: 'x', label: 'X', min: 0, max: Math.max(0, Number(canvasWidth) - (Number(selectedBlock.w) || 24)) },
                { key: 'y', label: 'Y', min: 0, max: Math.max(0, Number(canvasHeight) - (Number(selectedBlock.h) || 20)) },
                { key: 'w', label: 'W', min: 24, max: Math.max(24, Number(canvasWidth) - (Number(selectedBlock.x) || 0)) },
                { key: 'h', label: 'H', min: 20, max: Math.max(20, Number(canvasHeight) - (Number(selectedBlock.y) || 0)) }
              ].map(({ key, label, min, max }) => (
                <label key={key} className="block text-xs font-medium text-zinc-600">
                  <span className="mb-1 block">{label} (px)</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={1}
                    value={Number(selectedBlock[key]) || 0}
                    disabled={layoutLocked}
                    onChange={(e) => {
                      if (e.target.value === '') return;
                      const value = Number(e.target.value);
                      if (!Number.isFinite(value)) return;

                      const nextValue = Math.round(value);
                      const next = (Array.isArray(layout) ? layout : []).map((b) => {
                        if (b.id !== selectedBlock.id) return b;

                        const x = Number(b.x) || 0;
                        const y = Number(b.y) || 0;
                        const w = Number(b.w) || 24;
                        const h = Number(b.h) || 20;

                        if (key === 'x') {
                          return { ...b, x: clamp(nextValue, 0, Math.max(0, Number(canvasWidth) - w)) };
                        }
                        if (key === 'y') {
                          return { ...b, y: clamp(nextValue, 0, Math.max(0, Number(canvasHeight) - h)) };
                        }
                        if (key === 'w') {
                          return { ...b, w: clamp(nextValue, 24, Math.max(24, Number(canvasWidth) - x)) };
                        }
                        return { ...b, h: clamp(nextValue, 20, Math.max(20, Number(canvasHeight) - y)) };
                      });

                      setLayout(next);
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
                  />
                </label>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Arrow keys: move 1px · Shift + arrow: move 10px
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onReorderLayer('toBack')}
                disabled={layoutLocked || selectedIndex <= 0}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('sendToBack')}
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer('toFront')}
                disabled={layoutLocked || selectedIndex < 0 || selectedIndex >= (Array.isArray(layout) ? layout.length - 1 : 0)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('bringToFront')}
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer('backward')}
                disabled={layoutLocked || selectedIndex <= 0}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('sendBackward')}
              </button>
              <button
                type="button"
                onClick={() => onReorderLayer('forward')}
                disabled={layoutLocked || selectedIndex < 0 || selectedIndex >= (Array.isArray(layout) ? layout.length - 1 : 0)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                {t('bringForward')}
              </button>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-zinc-600">{t('alignToPage')}</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => alignSelectedToPage({ hAlign: 'left' })}
                  disabled={layoutLocked}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t('alignLeft')}
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToPage({ hAlign: 'center' })}
                  disabled={layoutLocked}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t('alignCenter')}
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToPage({ hAlign: 'right' })}
                  disabled={layoutLocked}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t('alignRight')}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => alignSelectedToPage({ vAlign: 'top' })}
                  disabled={layoutLocked}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t('alignTop')}
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToPage({ vAlign: 'middle' })}
                  disabled={layoutLocked}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t('alignMiddle')}
                </button>
                <button
                  type="button"
                  onClick={() => alignSelectedToPage({ vAlign: 'bottom' })}
                  disabled={layoutLocked}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {t('alignBottom')}
                </button>
              </div>
            </div>
          </div>

          <div className={activeInspectorTab === 'properties' ? 'space-y-3' : 'hidden'}>
          {selectedBlock.type === 'text' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-700">{t('content')}</label>
              {!layoutLocked ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="cms-font-color" className="block text-[11px] font-semibold text-zinc-600">{t('fontColor')}</label>
                    <input
                      id="cms-font-color"
                      name="fontColor"
                      type="color"
                      value={String(selectedBlock.content?.fontColor || '#18181b')}
                      onChange={(e) => updateSelectedContent({ fontColor: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="cms-line-height" className="block text-[11px] font-semibold text-zinc-600">{t('lineHeight')}</label>
                    <input
                      id="cms-line-height"
                      name="lineHeight"
                      type="number"
                      min={0.8}
                      max={3}
                      step={0.05}
                      value={Number(selectedBlock.content?.lineHeight) > 0 ? Number(selectedBlock.content.lineHeight) : 1.2}
                      onChange={(e) => updateSelectedContent({ lineHeight: Number(e.target.value) || 1.2 })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-1">
                <label htmlFor="cms-insert-placeholder" className="block text-[11px] font-semibold text-zinc-600">{t('insertPlaceholder')}</label>
                <select
                  id="cms-insert-placeholder"
                  name="placeholder"
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

          {!layoutLocked && selectedBlock.type === 'icon' ? (
            <div className="space-y-3 rounded-lg border border-zinc-200 p-3">
              <div className="text-xs font-semibold text-zinc-800">Icon settings</div>

              <div>
                {(() => {
                  const query = iconPickerSearch.trim().toLowerCase();
                  const aliases = {
                    scale: 'weight weighing mass net weight penimbang timbang berat',
                    ruler: 'dimensions size length width height measurement ukuran panjang lebar tinggi',
                    pill: 'dosage capsule medicine supplement tablet vitamin ubat pil kapsul suplemen',
                    package: 'bottle container packaging packing product jar botol bekas bungkusan',
                    boxes: 'cartons boxes package packaging kotak bungkusan',
                    'flask-conical': 'ingredients formula composition laboratory science bahan ramuan makmal',
                    beaker: 'ingredients laboratory science formula bahan ramuan makmal',
                    brain: 'cognitive memory focus mind otak memori fokus kognitif',
                    target: 'purpose intended use tujuan kegunaan sasaran',
                    certificate: 'certification halal haccp gmp quality sijil pensijilan kualiti',
                    'badge-check': 'verified approved quality pengesahan lulus sah',
                    thermometer: 'storage condition temperature suhu penyimpanan',
                    snowflake: 'cold cool refrigerated sejuk penyejukan',
                    clock: 'shelf life expiry expiration duration jangka hayat luput',
                    calendar: 'shelf life expiry expiration date tarikh luput',
                    leaf: 'ingredients natural botanical plant semula jadi tumbuhan',
                    'heart-pulse': 'health wellness benefits healthcare kesihatan kesejahteraan',
                    gauge: 'weight scale measurement meter indicator ukuran penunjuk penimbang',
                    'test-tube': 'laboratory sample specimen science tabung uji sampel makmal',
                    pipette: 'liquid dropper measurement laboratory cecair penitis makmal',
                    atom: 'science research molecule chemistry sains penyelidikan kimia',
                    stethoscope: 'health medical doctor clinic kesihatan perubatan doktor klinik',
                    syringe: 'medicine injection dosage ubat suntikan dos',
                    factory: 'manufacturing production plant kilang pembuatan pengeluaran',
                    handshake: 'partnership collaboration agreement kerjasama rakan kongsi',
                    warehouse: 'storage inventory logistics gudang penyimpanan inventori logistik',
                    'shopping-cart': 'shopping ecommerce buy purchase checkout beli troli',
                    barcode: 'product code identification scan kod bar produk imbas',
                    'qr-code': 'verification authenticate authenticity kod qr pengesahan',
                    'map-pinned': 'location address map alamat lokasi peta',
                    'globe-2': 'global international worldwide website dunia antarabangsa laman web',
                    'file-text': 'document information details dokumen maklumat butiran',
                    headset: 'customer support service help bantuan khidmat pelanggan',
                    recycle: 'recycling sustainability environment eco kelestarian alam sekitar',
                    vegan: 'plant based natural botanical vegan vegetarian tumbuhan'
                  };

                  const normalizedLibrary = (library) =>
                    library === 'fontawesome' ? 'fontawesome-solid' : library;

                  const matchesLibrary = (option) =>
                    iconPickerLibrary === 'all' ||
                    (iconPickerLibrary === 'lucide' && option.library === 'lucide') ||
                    (iconPickerLibrary === 'fontawesome' && option.library.startsWith('fontawesome-'));

                  const filteredOptions = CMS_ICON_OPTIONS.filter((option) => {
                    if (!matchesLibrary(option)) return false;
                    if (!query) return true;

                    const text = [
                      option.label,
                      option.value,
                      option.searchText,
                      aliases[option.value]
                    ].filter(Boolean).join(' ').toLowerCase();

                    return query.split(/\s+/).every((term) => text.includes(term));
                  });

                  const visibleOptions = filteredOptions.slice(0, iconPickerLimit);
                  const selectedName = String(selectedBlock.content?.iconName || 'star');
                  const selectedLibrary = normalizedLibrary(
                    String(selectedBlock.content?.iconLibrary || 'lucide')
                  );

                  const filters = [
                    {
                      value: 'all',
                      label: 'All Icons',
                      count: CMS_ICON_OPTIONS.length
                    },
                    {
                      value: 'lucide',
                      label: 'Lucide',
                      count: CMS_ICON_OPTIONS.filter((option) => option.library === 'lucide').length
                    },
                    {
                      value: 'fontawesome',
                      label: 'Font Awesome',
                      count: CMS_ICON_OPTIONS.filter((option) => option.library.startsWith('fontawesome-')).length
                    }
                  ];

                  return (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="cms-icon-search" className="block text-xs font-medium text-zinc-700">
                          Choose Icon
                        </label>
                        <span className="text-[11px] text-zinc-500" aria-live="polite">
                          {filteredOptions.length.toLocaleString()} icons
                        </span>
                      </div>

                      <div className="relative mt-2">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-4-4" />
                          </svg>
                        </span>
                        <input
                          id="cms-icon-search"
                          type="search"
                          value={iconPickerSearch}
                          onChange={(event) => {
                            setIconPickerSearch(event.target.value);
                            setIconPickerLimit(120);
                          }}
                          placeholder="Search icons, e.g. weight, bottle, dosage..."
                          aria-label="Search icons by name or keyword"
                          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                        />
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
                        {filters.map((filter) => (
                          <button
                            key={filter.value}
                            type="button"
                            onClick={() => {
                              setIconPickerLibrary(filter.value);
                              setIconPickerLimit(120);
                            }}
                            aria-pressed={iconPickerLibrary === filter.value}
                            className={`rounded-md px-1 py-1.5 text-[10px] font-medium transition ${
                              iconPickerLibrary === filter.value
                                ? 'bg-white text-zinc-900 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                          >
                            {filter.label} ({filter.count.toLocaleString()})
                          </button>
                        ))}
                      </div>

                      <div className="mt-2 text-[11px] text-zinc-500">
                        Showing {visibleOptions.length.toLocaleString()} of {filteredOptions.length.toLocaleString()}
                      </div>

                      <div
                        className="mt-2 grid max-h-40 grid-cols-4 gap-2 overflow-y-auto overscroll-contain pr-1"
                        role="group"
                        aria-label="Available icons"
                      >
                        {visibleOptions.map((option) => {
                          const selected =
                            selectedName === option.value &&
                            selectedLibrary === option.library;

                          return (
                            <button
                              key={`${option.library}:${option.value}`}
                              type="button"
                              onClick={() => updateSelectedContent({
                                iconName: option.value,
                                iconLibrary: option.library
                              })}
                              title={`${option.label} (${option.library})`}
                              aria-label={`Select ${option.label} icon`}
                              aria-pressed={selected}
                              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border p-2 transition ${
                                selected
                                  ? 'border-zinc-900 bg-zinc-100 ring-1 ring-zinc-900'
                                  : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
                              }`}
                            >
                              <span className="flex h-10 w-full items-center justify-center">
                                <CmsIcon
                                  content={{
                                    iconLibrary: option.library,
                                    iconName: option.value,
                                    iconColor: selectedBlock.content?.iconColor || '#27272a',
                                    iconSize: 24,
                                    backgroundEnabled: false,
                                    borderWidth: 0,
                                    borderRadius: 0
                                  }}
                                />
                              </span>
                              <span className="w-full truncate text-center text-[10px] leading-tight text-zinc-600">
                                {option.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {filteredOptions.length === 0 ? (
                        <p className="py-4 text-center text-xs text-zinc-500">
                          No icons match your search.
                        </p>
                      ) : null}

                      {visibleOptions.length < filteredOptions.length ? (
                        <button
                          type="button"
                          onClick={() => setIconPickerLimit((current) => current + 120)}
                          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Load more ({(filteredOptions.length - visibleOptions.length).toLocaleString()} remaining)
                        </button>
                      ) : null}
                    </>
                  );
                })()}
              </div>

              <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs font-semibold text-zinc-800">Icon link</div>

                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    name="linkEnabled"
                    checked={Boolean(selectedBlock.content?.linkEnabled)}
                    onChange={(e) => updateSelectedContent({ linkEnabled: e.target.checked })}
                    className="rounded border-zinc-300"
                  />
                  Enable link
                </label>

                {Boolean(selectedBlock.content?.linkEnabled) ? (
                  <div className="space-y-2">
                    <div>
                      <label htmlFor="cms-icon-link-url" className="block text-xs font-medium text-zinc-700">
                        Destination URL
                      </label>
                      <input
                        id="cms-icon-link-url"
                        name="linkUrl"
                        type="url"
                        value={String(selectedBlock.content?.linkUrl || '')}
                        onChange={(e) => updateSelectedContent({ linkUrl: e.target.value })}
                        placeholder="https://example.com"
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        name="openInNewTab"
                        checked={selectedBlock.content?.openInNewTab !== false}
                        onChange={(e) => updateSelectedContent({ openInNewTab: e.target.checked })}
                        className="rounded border-zinc-300"
                      />
                      Open in new tab
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cms-icon-color" className="block text-xs font-medium text-zinc-700">Icon color</label>
                  <input
                    id="cms-icon-color"
                    name="iconColor"
                    type="color"
                    value={String(selectedBlock.content?.iconColor || '#18181b')}
                    onChange={(e) => updateSelectedContent({ iconColor: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white p-1"
                  />
                </div>
                <div>
                  <label htmlFor="cms-icon-size" className="block text-xs font-medium text-zinc-700">Icon size (px)</label>
                  <input
                    id="cms-icon-size"
                    name="iconSize"
                    type="number"
                    min={8}
                    max={256}
                    value={Number(selectedBlock.content?.iconSize) || 40}
                    onChange={(e) => updateSelectedContent({ iconSize: Math.max(8, Math.min(256, Number(e.target.value) || 40)) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                <input
                  type="checkbox"
                  name="backgroundEnabled"
                  checked={Boolean(selectedBlock.content?.backgroundEnabled)}
                  onChange={(e) => updateSelectedContent({ backgroundEnabled: e.target.checked })}
                  className="rounded border-zinc-300"
                />
                Enable background
              </label>

              {Boolean(selectedBlock.content?.backgroundEnabled) ? (
                <div>
                  <label htmlFor="cms-icon-background-color" className="block text-xs font-medium text-zinc-700">Background color</label>
                  <input
                    id="cms-icon-background-color"
                    name="backgroundColor"
                    type="color"
                    value={String(selectedBlock.content?.backgroundColor || '#ffffff')}
                    onChange={(e) => updateSelectedContent({ backgroundColor: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white p-1"
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cms-icon-border-color" className="block text-xs font-medium text-zinc-700">Border color</label>
                  <input
                    id="cms-icon-border-color"
                    name="borderColor"
                    type="color"
                    value={String(selectedBlock.content?.borderColor || '#e4e4e7')}
                    onChange={(e) => updateSelectedContent({ borderColor: e.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white p-1"
                  />
                </div>
                <div>
                  <label htmlFor="cms-icon-border-width" className="block text-xs font-medium text-zinc-700">Border width (px)</label>
                  <input
                    id="cms-icon-border-width"
                    name="borderWidth"
                    type="number"
                    min={0}
                    max={20}
                    value={Number(selectedBlock.content?.borderWidth) || 0}
                    onChange={(e) => updateSelectedContent({ borderWidth: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cms-icon-border-radius" className="block text-xs font-medium text-zinc-700">Border radius (px)</label>
                <input
                  id="cms-icon-border-radius"
                  name="borderRadius"
                  type="number"
                  min={0}
                  max={100}
                  value={Number(selectedBlock.content?.borderRadius ?? 12)}
                  onChange={(e) => updateSelectedContent({ borderRadius: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : null}

          {!layoutLocked && (selectedBlock.type === 'container' || selectedBlock.type === 'supporting_document') ? (
            <div className="space-y-3">
              {selectedBlock.type === 'supporting_document' ? (
                <div className="space-y-2">
                  <div>
                    <label htmlFor="cms-supporting-document-type" className="block text-xs font-medium text-zinc-700">{t('supportingDocumentType')}</label>
                    <select id="cms-supporting-document-type" name="supportingDocumentType"
                      value={String(selectedBlock.content?.docType || '')}
                      onChange={(e) => updateSelectedContent({ docType: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      {(() => {
                        const uploadedOptions = (Array.isArray(supportingDocumentTypes) ? supportingDocumentTypes : [])
                          .map((item) => {
                            const value = String(item?.docType ?? item ?? '').trim().replace(/\s+/g, ' ');
                            return value ? { value, label: value } : null;
                          })
                          .filter(Boolean);

                        const currentValue = String(selectedBlock.content?.docType || '').trim();
                        const options = [...uploadedOptions];

                        if (currentValue && !options.some((option) => option.value.toLocaleLowerCase() === currentValue.toLocaleLowerCase())) {
                          options.push({ value: currentValue, label: currentValue });
                        }

                        const seen = new Set();
                        return options
                          .filter((option) => {
                            const key = option.value.toLocaleLowerCase();
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                          })
                          .map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ));
                      })()}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cms-supporting-document-title" className="block text-xs font-medium text-zinc-700">{t('title')}</label>
                    <input
                      id="cms-supporting-document-title"
                      name="supportingDocumentTitle"
                      value={String(selectedBlock.content?.label || '')}
                      onChange={(e) => updateSelectedContent({ label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      placeholder=""
                    />
                  </div>
                </div>
              ) : null}
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
                      <label htmlFor="cms-background-fill" className="block text-xs font-medium text-zinc-700">{t('backgroundFill')}</label>
                      <select id="cms-background-fill" name="backgroundFill"
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
                          <label htmlFor="cms-gradient-from" className="block text-xs font-medium text-zinc-700">{t('gradientFrom')}</label>
                          <input id="cms-gradient-from" name="gradientFrom"
                            type="color"
                            value={from}
                            onChange={(e) => updateSelectedContent({ gradientFrom: e.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                          />
                        </div>
                        <div>
                          <label htmlFor="cms-gradient-to" className="block text-xs font-medium text-zinc-700">{t('gradientTo')}</label>
                          <input id="cms-gradient-to" name="gradientTo"
                            type="color"
                            value={to}
                            onChange={(e) => updateSelectedContent({ gradientTo: e.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="cms-background-color" className="block text-xs font-medium text-zinc-700">{t('backgroundColor')}</label>
                        <input id="cms-background-color" name="backgroundColor"
                          type="color"
                          value={bg}
                          onChange={(e) => updateSelectedContent({ backgroundColor: e.target.value })}
                          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                        />
                      </div>
                    )}

                    {fill === 'gradient' ? (
                      <div>
                        <label htmlFor="cms-gradient-angle" className="block text-xs font-medium text-zinc-700">{t('gradientAngle')}</label>
                        <input id="cms-gradient-angle" name="gradientAngle"
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
                <label htmlFor="cms-border-color" className="block text-xs font-medium text-zinc-700">{t('borderColor')}</label>
                <input id="cms-border-color" name="borderColor"
                  type="color"
                  value={String(selectedBlock.content?.borderColor || '#e4e4e7')}
                  onChange={(e) => updateSelectedContent({ borderColor: e.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="cms-border-width" className="block text-xs font-medium text-zinc-700">{t('borderWidth')}</label>
                  <input id="cms-border-width" name="borderWidth"
                    type="number"
                    min={0}
                    max={20}
                    value={Number(selectedBlock.content?.borderWidth ?? 1)}
                    onChange={(e) => updateSelectedContent({ borderWidth: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cms-border-radius" className="block text-xs font-medium text-zinc-700">{t('borderRadius')}</label>
                  <input id="cms-border-radius" name="borderRadius"
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
                <label htmlFor="cms-opacity" className="block text-xs font-medium text-zinc-700">{t('opacity')}</label>
                <input id="cms-opacity" name="opacity"
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
                <label htmlFor="cms-certificate-block-type" className="block text-xs font-medium text-zinc-700">{t('certificateBlockType')}</label>
                <select id="cms-certificate-block-type" name="certificateBlockType"
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
                  <label htmlFor="cms-certificate-template" className="block text-xs font-medium text-zinc-700">{t('certTemplate')}</label>
                  <select id="cms-certificate-template" name="certificateTemplateId"
                    value={selectedBlock.content?.certificateTemplateId != null ? String(selectedBlock.content.certificateTemplateId) : ''}
                    onChange={(e) => updateSelectedContent({ certificateTemplateId: e.target.value ? Number(e.target.value) : undefined })}
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
              <label htmlFor="cms-media-url" className="block text-xs font-medium text-zinc-700">{t('url')}</label>
              <input id="cms-media-url" name="mediaUrl"
                value={selectedBlock.content?.url || ''}
                onChange={(e) => updateSelectedContent({ url: normalizeCmsBlockUrl(selectedBlock.type, e.target.value) })}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="https://..."
              />
              {selectedBlock.type === 'video' ? (
                <div className="mt-1 text-[11px] text-zinc-500">{t('videoUrlHint')}</div>
              ) : null}
              {selectedBlock.type === 'image' ? (
                <>
                  <div className="mt-2">
                    <label htmlFor="cms-image-mode" className="block text-xs font-medium text-zinc-700">{t('imageMode')}</label>
                    <select id="cms-image-mode" name="imageMode"
                      value={selectedBlock.content?.mode || 'fit'}
                      onChange={(e) => updateSelectedContent({ mode: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="fit">{t('actualOrFit')}</option>
                      <option value="stretch">{t('stretch')}</option>
                    </select>
                  </div>
                  <div className="mt-2">
                    <label htmlFor="cms-image-link-url" className="block text-xs font-medium text-zinc-700">{t('links')}</label>
                    <input id="cms-image-link-url" name="linkUrl"
                      value={String(selectedBlock.content?.linkUrl || '')}
                      onChange={(e) => updateSelectedContent({ linkUrl: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                    <label className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedBlock.content?.openInNewTab)}
                        onChange={(e) => updateSelectedContent({ openInNewTab: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      <span className="text-xs">{t('openInNewTab')}</span>
                    </label>
                  </div>
                </>
              ) : null}
              <div className="mt-2">
                <label htmlFor="cms-media-file" className="block text-xs font-medium text-zinc-700">{t('file')}</label>
                <input id="cms-media-file" name="mediaFile"
                  key={fileKey}
                  type="file"
                  accept={accept}
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFileKey((k) => k + 1);
                    if (isFileTooLarge(file)) {
                      setUploadError(t('fileTooLargeMaxMb', { mb: MAX_UPLOAD_MB }));
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
                <div className="mt-1 text-[11px] text-zinc-500">{t('maxFileSize', { mb: MAX_UPLOAD_MB })}</div>
                {uploading ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-600">
                      <div>{uploadPhase === 'processing' ? t('processing') : t('uploading')}</div>
                      {Number.isFinite(uploadPct) ? <div>{uploadPct}%</div> : null}
                    </div>
                    {Number.isFinite(uploadPct) ? (
                      <div className="h-2 w-full overflow-hidden rounded bg-zinc-100">
                        <div className="h-full bg-indigo-600" style={{ width: `${uploadPct}%` }} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                        const resolved = resolvePublicMediaUrl(rawUrl);
                        const abs = new URL(resolved, window.location.origin).toString();
                        const res = await fetch(abs, { credentials: 'include' });
                        if (!res.ok) throw new Error(t('failedToLoadImageWithStatus', { status: res.status }));
                        const blob = await res.blob();
                        const name = decodeURIComponent(abs.split('/').pop() || 'image');
                        const f = new File([blob], name, { type: blob.type || 'image/jpeg', lastModified: Date.now() });
                        setCropFile(f);
                        setCropBlockId(selectedBlock.id);
                        setCropOpen(true);
                      } catch (err) {
                        setUploadError(String(err?.message || t('failedToLoadImage')));
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
