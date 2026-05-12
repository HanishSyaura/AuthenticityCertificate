import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CanvasStage from '../../components/admin/CanvasStage';
import RichTextEditor from '../../components/admin/RichTextEditor';
import { useT } from '../../i18n/useT';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useI18nStore from '../../store/useI18nStore';
import useUploadsStore from '../../store/useUploadsStore';
import useEpcStore from '../../store/useEpcStore';
import { stripHtmlToText, toQuillHtml } from '../../utils/richText';
import { sanitizeLimitedHtml } from '../../utils/sanitizeLimitedHtml';
import { MAX_UPLOAD_MB } from '../../utils/uploadLimits';

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function normalizeTemplateId(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) return null;
  return String(n);
}

function getValue(path, data) {
  const parts = String(path).split('.');
  let cur = data;
  for (const p of parts) {
    cur = cur?.[p];
  }
  return cur ?? '';
}

function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeTextToHtml(input) {
  return escapeHtml(input).replaceAll('\n', '<br/>');
}

function inlineizeHtml(input) {
  let s = String(input || '');
  if (!s) return '';
  s = s.replace(/\r?\n/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<(\/?)p(\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  s = s.replace(/<(\/?)div(\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  s = s.replace(/<(\/?)blockquote(\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  s = s.replace(/<(\/?)h[1-6](\s[^>]*)?>/gi, (m, close, attrs) => (close ? '</span>' : `<span${attrs || ''}>`));
  return s;
}

function buildPrefixHtml({ showPrefix, key, placeholder, item }) {
  if (!showPrefix) return '';
  const labelText = key
    ? String(stripHtmlToText(placeholder?.labelHtml ?? placeholder?.label ?? key) || '').trim()
    : String(stripHtmlToText(item?.labelHtml ?? item?.label ?? '') || '').trim();
  if (!labelText) return '';

  if (key) {
    const labelHtml = String(placeholder?.labelHtml || '').trim()
      ? sanitizeLimitedHtml(placeholder.labelHtml)
      : escapeHtml(String(placeholder?.label || key));
    const separatorHtml = String(placeholder?.separatorHtml || '').trim()
      ? sanitizeLimitedHtml(placeholder.separatorHtml)
      : escapeHtml(String(placeholder?.separator ?? ': '));
    return `<span style="font-weight: 700">${inlineizeHtml(labelHtml)}${inlineizeHtml(separatorHtml)}</span>`;
  }

  const labelHtml = String(item?.labelHtml || '').trim() ? sanitizeLimitedHtml(item.labelHtml) : escapeHtml(String(item?.label || ''));
  return `<span style="font-weight: 700">${inlineizeHtml(labelHtml)}${escapeHtml(': ')}</span>`;
}

function normalizeKeyCandidate(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
}

function makeUniqueKey(input, usedLower) {
  const base = normalizeKeyCandidate(input) || 'field';
  let candidate = base;
  let i = 1;
  while (usedLower.has(candidate.toLowerCase())) {
    i += 1;
    candidate = `${base}_${i}`;
  }
  return candidate;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sampleBatchValueByKey(key) {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return '';
  if (k.includes('swiftlet') || k.includes('house')) return '160212';
  if (k.includes('manufacture') || k.includes('production') || k.includes('date')) return '2025-07-11';
  if (k.includes('batch')) return 'MSAL 24LT';
  return 'SAMPLE';
}

function useElementSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref?.current;
    if (!el) return undefined;

    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width || 0, h: r.height || 0 });
    };

    update();

    if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'function') {
      const ro = new window.ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref]);

  return size;
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

export default function AdminCertificateTemplateBuilder({ initialSelectedId = null, uiMode = 'builder' }) {
  const { t } = useT();
  const uiLang = useI18nStore((s) => s.lang);
  const { templates, error, fetchTemplates, fetchTemplate, updateTemplate, fillEmptyFromEn, deleteTemplate } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    error: s.error,
    fetchTemplates: s.fetchTemplates,
    fetchTemplate: s.fetchTemplate,
    updateTemplate: s.updateTemplate,
    fillEmptyFromEn: s.fillEmptyFromEn,
    deleteTemplate: s.deleteTemplate
  }));
  const { uploadMedia } = useUploadsStore((s) => ({ uploadMedia: s.uploadMedia }));
  const { batches, fetchBatches, updateBatch } = useEpcStore((s) => ({
    batches: s.batches,
    fetchBatches: s.fetchBatches,
    updateBatch: s.updateBatch
  }));

  const isDesigner = String(uiMode || 'builder') === 'designer';
  const [selectedId, setSelectedId] = useState(() => normalizeTemplateId(initialSelectedId));
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState(null);
  const [bgFileKey, setBgFileKey] = useState(0);
  const [wizardStep, setWizardStep] = useState(isDesigner ? 'canvas' : 'fields');
  const [addOverlayKey, setAddOverlayKey] = useState('');
  const [expandedPlaceholderKey, setExpandedPlaceholderKey] = useState(null);
  const [devicePresetId, setDevicePresetId] = useState('fit');
  const [backgroundMode, setBackgroundMode] = useState('background');
  const [assignedBatchIds, setAssignedBatchIds] = useState(() => new Set());
  const [draftPlaceholders, setDraftPlaceholders] = useState([]);
  const [draftLayout, setDraftLayout] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [designerRightTab, setDesignerRightTab] = useState('preview');
  const [designerZoomMode, setDesignerZoomMode] = useState('fit');
  const [designerZoomPct, setDesignerZoomPct] = useState(125);
  const [largeUi, setLargeUi] = useState(true);
  const designerCanvasViewportRef = useRef(null);
  const builderCanvasViewportRef = useRef(null);
  const persistTimerRef = useRef(null);
  const pendingPatchRef = useRef(null);
  const basePersistTimerRef = useRef(null);
  const pendingBasePatchRef = useRef(null);
  const activeTemplateIdRef = useRef(null);
  const localEditSeqRef = useRef(0);
  const hydratedEditSeqRef = useRef(0);
  const previewNowRef = useRef(new Date().toISOString());
  const hydratedTemplateIdRef = useRef(null);
  const hydratedTemplateLangRef = useRef(null);
  const saveSeqRef = useRef(0);
  const baseSaveSeqRef = useRef(0);
  const prevSelectedIdRef = useRef(null);
  const selectedPlaceholdersRef = useRef([]);
  const initialContentLang = useMemo(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('ac:templateLang') : null;
      const v = String(stored || '').trim().toLowerCase();
      if (v === 'en' || v === 'ms' || v === 'zh') return v;
    } catch (e) {
      void e;
    }
    const v = String(uiLang || '').trim().toLowerCase();
    if (v === 'en' || v === 'ms' || v === 'zh') return v;
    return 'en';
  }, [uiLang]);
  const [contentLang, setContentLang] = useState(initialContentLang);
  const contentLangRef = useRef(initialContentLang);
  const layoutLocked = String(contentLang || 'en') !== 'en';

  const selected = useMemo(() => templates.find((it) => String(it.id) === String(selectedId)) || null, [templates, selectedId]);
  const canvasW = Number(selected?.canvasWidth) > 0 ? Number(selected.canvasWidth) : 390;
  const canvasH = Number(selected?.canvasHeight) > 0 ? Number(selected.canvasHeight) : 844;
  const canvasBgColor = String(selected?.backgroundColor || '#ffffff');
  const devicePreset = useMemo(() => DEVICE_PRESETS.find((d) => d.id === devicePresetId) || DEVICE_PRESETS[0], [devicePresetId]);
  const builderViewportSize = useElementSize(builderCanvasViewportRef);
  const fitBuilderScale = useMemo(() => {
    const w = Number(builderViewportSize?.w) || 0;
    const h = Number(builderViewportSize?.h) || 0;
    if (!w || !h) return 1;
    const pad = 16;
    const availW = Math.max(1, w - pad);
    const availH = Math.max(1, h - pad);
    const s = Math.min(availW / Math.max(1, canvasW), availH / Math.max(1, canvasH));
    return clamp(s, 0.1, 6);
  }, [builderViewportSize?.h, builderViewportSize?.w, canvasH, canvasW]);
  const builderScale = useMemo(() => {
    if (!devicePreset) return 1;
    if (devicePreset.id === 'fit') return fitBuilderScale;
    if (Number(devicePreset.scale) > 0) return clamp(Number(devicePreset.scale), 0.1, 6);
    if (!devicePreset.w) return 1;
    const sw = Number(devicePreset.w) / Math.max(1, canvasW);
    const sh = Number(devicePreset.h || devicePreset.w) / Math.max(1, canvasH);
    return clamp(Math.min(sw, sh), 0.1, 6);
  }, [canvasH, canvasW, devicePreset, fitBuilderScale]);
  const designerViewportSize = useElementSize(designerCanvasViewportRef);
  const fitDesignerScale = useMemo(() => {
    const w = Number(designerViewportSize?.w) || 0;
    const h = Number(designerViewportSize?.h) || 0;
    if (!w || !h) return 1;
    const pad = 16;
    const availW = Math.max(1, w - pad);
    const availH = Math.max(1, h - pad);
    const s = Math.min(availW / Math.max(1, canvasW), availH / Math.max(1, canvasH));
    return clamp(s, 0.1, 6);
  }, [canvasH, canvasW, designerViewportSize?.h, designerViewportSize?.w]);
  const designerScale = useMemo(() => {
    if (String(designerZoomMode || '') === 'fit') return fitDesignerScale;
    return clamp((Number(designerZoomPct) || 100) / 100, 0.1, 6);
  }, [designerZoomMode, designerZoomPct, fitDesignerScale]);
  const canvasScale = isDesigner ? designerScale : builderScale;

  const placeholders = useMemo(() => (Array.isArray(draftPlaceholders) ? draftPlaceholders : []), [draftPlaceholders]);

  useEffect(() => {
    selectedPlaceholdersRef.current = Array.isArray(selected?.placeholders) ? selected.placeholders : [];
  }, [selected?.placeholders]);

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
    const assigned = assignedBatchIds instanceof Set ? assignedBatchIds : new Set();
    const previewBatch =
      (Array.isArray(batches) ? batches : []).find((b) => assigned.has(String(b?.id ?? ''))) || null;
    const batchTemplateDataRaw = previewBatch?.templateData;
    const batchTemplateDataBase =
      batchTemplateDataRaw && typeof batchTemplateDataRaw === 'object' && !Array.isArray(batchTemplateDataRaw) ? batchTemplateDataRaw : {};
    const batchTemplateData = {
      ...batchTemplateDataBase,
      ...(batchTemplateDataBase.swiftletHouseNumb == null && batchTemplateDataBase.swiftletHouseNumber != null
        ? { swiftletHouseNumb: batchTemplateDataBase.swiftletHouseNumber }
        : {}),
      ...(batchTemplateDataBase.swiftletHouseNumber == null && batchTemplateDataBase.swiftletHouseNumb != null
        ? { swiftletHouseNumber: batchTemplateDataBase.swiftletHouseNumb }
        : {})
    };
    const getBatchTemplateValue = (key) => {
      const k = String(key || '').trim();
      if (!k) return '';
      const v = batchTemplateData?.[k];
      if (v != null && String(v).trim()) return String(v);
      if (k === 'swiftletHouseNumb') {
        const alt = batchTemplateData?.swiftletHouseNumber;
        if (alt != null && String(alt).trim()) return String(alt);
      }
      if (k === 'swiftletHouseNumber') {
        const alt = batchTemplateData?.swiftletHouseNumb;
        if (alt != null && String(alt).trim()) return String(alt);
      }
      return '';
    };
    const fallback = {
      certificateId: String(selected?.certificateId || '').trim() || (selected?.id != null ? `CERT-${selected.id}` : 'CERT-0001'),
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
      },
      epcItem: {
        netWeight: '3g',
        caiqNumber: 'CAIQ-000000',
        productionDate: '2026-01-01'
      }
    };
    const base = fallback;
    const templateData = {};
    const evalRoot = {
      product: base.product || null,
      batch: { ...(base.batch || {}), templateData: batchTemplateData },
      certificate: { ...(base || {}), templateData: batchTemplateData },
      epcItem: base.epcItem || null,
      templateData: batchTemplateData
    };
    for (const p of list) {
      const key = String(p?.key || '').trim();
      if (!key) continue;
      const source = String(p?.source || '').trim();
      const bindPath = String(p?.bindPath || '').trim();
      if (source === 'product') {
        const normalizedBindPath = bindPath.startsWith('templateData.') ? `certificate.${bindPath}` : bindPath;
        templateData[key] = normalizedBindPath ? getValue(normalizedBindPath, evalRoot) : '';
        continue;
      }
      if (source === 'static' || source === 'title') {
        templateData[key] = String(p?.staticValue || '');
        continue;
      }
      if (source === 'manual') {
        templateData[key] = String(p?.sample || '');
        continue;
      }
      if (source === 'batch') {
        templateData[key] = getBatchTemplateValue(key) || sampleBatchValueByKey(key);
        continue;
      }
      templateData[key] = '';
    }
    return { ...base, templateData: { ...(base.templateData || {}), ...templateData } };
  }, [assignedBatchIds, batches, placeholders, selected?.certificateId, selected?.id]);

  const canvasItems = useMemo(() => {
    const layout = Array.isArray(draftLayout) ? draftLayout : [];
    return layout.map((f) => ({
      ...(f || {}),
      render: (it) => (
        <div className="h-full w-full p-[2px]">
          {(() => {
            const raw = safePreview ? getValue(it.path, safePreview) : '';
            const path = String(it.path || '');
            const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
            const ph = key ? placeholderByKey.get(key) : null;
            const val = raw == null ? '' : String(raw);
            const source = String(ph?.source || '').trim();
            const showPrefix = source !== 'title';
            const prefixRaw = buildPrefixHtml({ showPrefix, key, placeholder: ph, item: it });
            const valueHtmlRaw = source === 'static' || source === 'manual' || source === 'batch' || source === 'title' ? val : escapeTextToHtml(val);
            const valueHtml = inlineizeHtml(String(valueHtmlRaw || ''));
            const html = inlineizeHtml(sanitizeLimitedHtml(`${prefixRaw}${valueHtml || ''}`));
            const fs = Number(it.fontSize) > 0 ? Number(it.fontSize) : 14;
            const align = textAlignClass(it.align);
            const wrap = typeof it.wrap === 'boolean' ? it.wrap : true;
            return (
              <div
                className={`ql-editor ac-richtext text-zinc-900 ${align} ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'}`}
                style={{
                  fontSize: fs,
                  lineHeight: 1.2,
                  textAlign: String(it.align || 'left'),
                  whiteSpace: wrap ? 'pre-wrap' : 'nowrap',
                  overflowWrap: wrap ? 'anywhere' : undefined,
                  wordBreak: wrap ? 'break-word' : undefined
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
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
        const val = raw == null ? '' : String(raw);
        const source = String(ph?.source || '').trim();
        const showPrefix = source !== 'title';
        const prefixRaw = buildPrefixHtml({ showPrefix, key, placeholder: ph, item: it });
        const valueHtmlRaw = source === 'static' || source === 'manual' || source === 'batch' || source === 'title' ? val : escapeTextToHtml(val);
        const valueHtml = inlineizeHtml(String(valueHtmlRaw || ''));
        const html = inlineizeHtml(sanitizeLimitedHtml(`${prefixRaw}${valueHtml || ''}`));
        const fs = Number(it.fontSize) > 0 ? Number(it.fontSize) : 14;
        const align = textAlignClass(it.align);
        const wrap = typeof it.wrap === 'boolean' ? it.wrap : true;
        return (
          <div
            className={`ql-editor ac-richtext h-full w-full ${align} ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'}`}
            style={{
              fontSize: fs,
              lineHeight: 1.2,
              textAlign: String(it.align || 'left'),
              whiteSpace: wrap ? 'pre-wrap' : 'nowrap',
              overflowWrap: wrap ? 'anywhere' : undefined,
              wordBreak: wrap ? 'break-word' : undefined
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
    }));
  }, [draftLayout, placeholderByKey, safePreview]);

  const selectedField = useMemo(() => (Array.isArray(draftLayout) ? draftLayout : []).find((f) => f.id === selectedFieldId) || null, [draftLayout, selectedFieldId]);

  const flushPendingPatch = useCallback(
    (id) => {
      const templateId = id ?? activeTemplateIdRef.current;
      if (!templateId) return;
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (basePersistTimerRef.current) {
        window.clearTimeout(basePersistTimerRef.current);
        basePersistTimerRef.current = null;
      }
      const langToSend = contentLangRef.current || 'en';
      const toSend = pendingPatchRef.current;
      pendingPatchRef.current = null;
      const toSendBase = pendingBasePatchRef.current;
      pendingBasePatchRef.current = null;
      if (toSend) void updateTemplate({ id: templateId, patch: toSend, lang: langToSend });
      if (toSendBase) void updateTemplate({ id: templateId, patch: toSendBase, lang: 'en' });
    },
    [updateTemplate]
  );

  const markLocalEdit = useCallback(() => {
    localEditSeqRef.current += 1;
  }, []);

  useEffect(() => {
    const nextId = selected?.id ?? null;
    const prevId = activeTemplateIdRef.current;
    if (prevId != null && nextId != null && String(prevId) !== String(nextId)) flushPendingPatch(prevId);
    activeTemplateIdRef.current = nextId;
  }, [flushPendingPatch, selected?.id]);

  useEffect(() => () => flushPendingPatch(), [flushPendingPatch]);

  useEffect(() => {
    const id = selected?.id ? String(selected.id) : null;
    if (!id) return;
    const langKey = String(contentLangRef.current || contentLang || 'en');
    const selectedPlaceholders = Array.isArray(selected?.placeholders) ? selected.placeholders : [];
    const selectedLayout = Array.isArray(selected?.layoutJson) ? selected.layoutJson : [];
    const selectedBgMode = String(selected?.backgroundMode || '').trim() || 'background';
    const noLocalEditsSinceHydrate = hydratedEditSeqRef.current === localEditSeqRef.current;

    if (hydratedTemplateIdRef.current !== id || hydratedTemplateLangRef.current !== langKey) {
      hydratedTemplateIdRef.current = id;
      hydratedTemplateLangRef.current = langKey;
      setDraftPlaceholders(selectedPlaceholders);
      setDraftLayout(selectedLayout);
      setBackgroundMode(selectedBgMode);
      pendingPatchRef.current = null;
      pendingBasePatchRef.current = null;
      setSaveStatus('idle');
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (basePersistTimerRef.current) {
        window.clearTimeout(basePersistTimerRef.current);
        basePersistTimerRef.current = null;
      }
      hydratedEditSeqRef.current = localEditSeqRef.current;
      return;
    }

    if (!noLocalEditsSinceHydrate) return;

    const curLayout = Array.isArray(draftLayout) ? draftLayout : [];
    if (curLayout.length === 0 && selectedLayout.length > 0) {
      setDraftLayout(selectedLayout);
    }

    const curPlaceholders = Array.isArray(draftPlaceholders) ? draftPlaceholders : [];
    if (curPlaceholders.length === 0 && selectedPlaceholders.length > 0) {
      setDraftPlaceholders(selectedPlaceholders);
    }

    if (!String(backgroundMode || '').trim()) setBackgroundMode(selectedBgMode);
  }, [backgroundMode, contentLang, draftLayout, draftPlaceholders, selected?.backgroundMode, selected?.id, selected?.layoutJson, selected?.placeholders]);

  const queueTemplatePatch = useCallback((patch) => {
    const id = selected?.id;
    if (!id) return;
    pendingPatchRef.current = { ...(pendingPatchRef.current || {}), ...(patch || {}) };
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      const toSend = pendingPatchRef.current;
      pendingPatchRef.current = null;
      if (!toSend) return;
      const seq = (saveSeqRef.current += 1);
      setSaveStatus('saving');
      void (async () => {
        try {
          await updateTemplate({ id, patch: toSend, lang: contentLangRef.current || 'en' });
          if (seq !== saveSeqRef.current) return;
          setSaveStatus('saved');
        } catch (e) {
          if (seq !== saveSeqRef.current) return;
          setSaveStatus('error');
        }
      })();
    }, 350);
  }, [selected?.id, updateTemplate]);

  const queueBasePatch = useCallback((patch) => {
    const id = selected?.id;
    if (!id) return;
    pendingBasePatchRef.current = { ...(pendingBasePatchRef.current || {}), ...(patch || {}) };
    if (basePersistTimerRef.current) window.clearTimeout(basePersistTimerRef.current);
    basePersistTimerRef.current = window.setTimeout(() => {
      const toSend = pendingBasePatchRef.current;
      pendingBasePatchRef.current = null;
      if (!toSend) return;
      const seq = (baseSaveSeqRef.current += 1);
      setSaveStatus('saving');
      void (async () => {
        try {
          await updateTemplate({ id, patch: toSend, lang: 'en' });
          if (seq !== baseSaveSeqRef.current) return;
          setSaveStatus('saved');
        } catch (e) {
          if (seq !== baseSaveSeqRef.current) return;
          setSaveStatus('error');
        }
      })();
    }, 350);
  }, [selected?.id, updateTemplate]);

  const updateSelected = async (patch) => {
    if (!selected) return;
    const seq = (saveSeqRef.current += 1);
    setSaveStatus('saving');
    try {
      await updateTemplate({ id: selected.id, patch, lang: 'en' });
      if (seq !== saveSeqRef.current) return;
      setSaveStatus('saved');
    } catch (e) {
      if (seq !== saveSeqRef.current) return;
      setSaveStatus('error');
    }
  };

  const addCanvasItemForKey = (key) => {
    if (layoutLocked) return;
    if (!selected) return;
    const k = String(key || '').trim();
    if (!k) return;
    const ph = placeholders.find((p) => String(p?.key || '').trim() === k) || null;
    const labelText = String(stripHtmlToText(ph?.labelHtml ?? ph?.label ?? k) || '').trim() || k;
    const labelHtml = String(ph?.labelHtml || '') ? String(ph.labelHtml) : toQuillHtml(labelText);
    const item = { id: makeId('field'), path: `templateData.${k}`, label: labelText, labelHtml, x: 20, y: 40, w: 200, h: 44, fontSize: 14, align: 'left', wrap: true };
    const nextLayout = [...(Array.isArray(draftLayout) ? draftLayout : []), item];
    markLocalEdit();
    setDraftLayout(nextLayout);
    queueTemplatePatch({ layoutJson: nextLayout });
    setSelectedFieldId(item.id);
  };

  useEffect(() => {
    contentLangRef.current = contentLang;
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('ac:templateLang', String(contentLang || 'en'));
    } catch (e) {
      void e;
    }
  }, [contentLang]);

  useEffect(() => {
    void fetchTemplates({ lang: contentLang });
  }, [contentLang, fetchTemplates]);

  useEffect(() => {
    const id = normalizeTemplateId(selectedId);
    if (!id) return;
    void fetchTemplate({ id, lang: contentLang });
  }, [contentLang, fetchTemplate, selectedId]);

  const sanitizeLayout = (nextFields) =>
    (nextFields || []).map((field) => {
      const next = { ...(field || {}) };
      delete next.render;
      return next;
    });

  const setCanvasItems = (updaterOrNext) => {
    if (layoutLocked) return;
    const current = Array.isArray(draftLayout) ? draftLayout : [];
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(current) : updaterOrNext;
    const sanitized = sanitizeLayout(next);
    markLocalEdit();
    setDraftLayout(sanitized);
    queueTemplatePatch({ layoutJson: sanitized });
  };

  const updateField = (patch) => {
    if (layoutLocked) return;
    if (!selectedField || !selected) return;
    const minW = 24;
    const minH = 20;
    const nextLayout = (Array.isArray(draftLayout) ? draftLayout : []).map((f) => {
      if (f.id !== selectedField.id) return f;
      const merged = { ...f, ...(patch || {}) };
      const w = clamp(Number(merged.w) || minW, minW, Math.max(minW, canvasW - (Number(merged.x) || 0)));
      const h = clamp(Number(merged.h) || minH, minH, Math.max(minH, canvasH - (Number(merged.y) || 0)));
      const x = clamp(Number(merged.x) || 0, 0, Math.max(0, canvasW - w));
      const y = clamp(Number(merged.y) || 0, 0, Math.max(0, canvasH - h));
      return { ...merged, x, y, w, h };
    });
    markLocalEdit();
    setDraftLayout(nextLayout);
    queueTemplatePatch({ layoutJson: nextLayout });
  };

  const replacePlaceholders = useCallback((next) => {
    const arr = Array.isArray(next) ? next : [];
    markLocalEdit();
    setDraftPlaceholders(arr);
    queueTemplatePatch({ placeholders: arr });
  }, [markLocalEdit, queueTemplatePatch]);

  const updatePlaceholder = useCallback((key, patch) => {
    const k = String(key || '').trim();
    if (!k) return;
    const idx = (Array.isArray(placeholders) ? placeholders : []).findIndex((p) => String(p?.key || '').trim() === k);
    if (idx < 0) return;
    const safePatch = layoutLocked
      ? {
          ...(patch?.label !== undefined ? { label: patch.label } : {}),
          ...(patch?.labelHtml !== undefined ? { labelHtml: patch.labelHtml } : {}),
          ...(patch?.separator !== undefined ? { separator: patch.separator } : {}),
          ...(patch?.separatorHtml !== undefined ? { separatorHtml: patch.separatorHtml } : {}),
          ...(patch?.staticValue !== undefined ? { staticValue: patch.staticValue } : {})
        }
      : patch;
    const next = placeholders.slice();
    next[idx] = { ...(next[idx] || {}), ...(safePatch || {}) };
    replacePlaceholders(next);
  }, [layoutLocked, placeholders, replacePlaceholders]);

  useEffect(() => {
    if (layoutLocked) return;
    const list = Array.isArray(placeholders) ? placeholders : [];
    if (list.length === 0) return;
    if (!list.some((p) => !String(p?.key || '').trim())) return;
    const used = new Set();
    const next = list.map((p, i) => {
      const curKey = String(p?.key || '').trim();
      if (curKey) {
        used.add(curKey.toLowerCase());
        return p;
      }
      const label = String(stripHtmlToText(p?.labelHtml ?? p?.label ?? '') || '').trim();
      const base = label || `field_${i + 1}`;
      const key = makeUniqueKey(base, used);
      used.add(key.toLowerCase());
      return { ...(p || {}), key };
    });
    replacePlaceholders(next);
  }, [layoutLocked, placeholders, replacePlaceholders]);

  const replacePlaceholdersAndLayout = ({ nextPlaceholders, nextLayout }) => {
    if (layoutLocked) return;
    const ph = Array.isArray(nextPlaceholders) ? nextPlaceholders : [];
    const ly = Array.isArray(nextLayout) ? nextLayout : [];
    markLocalEdit();
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
      const label = String(stripHtmlToText(p?.labelHtml ?? p?.label ?? '') || '').trim();
      const source = String(p.source || 'static');
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
    if (initialSelectedId == null) return;
    setSelectedId(normalizeTemplateId(initialSelectedId));
    setSelectedFieldId(null);
  }, [initialSelectedId]);

  useEffect(() => {
    void fetchBatches({ limit: 200, offset: 0 });
  }, [fetchBatches]);

  useEffect(() => {
    if (selectedId != null) return;
    if (templates.length > 0) setSelectedId(String(templates[0].id));
  }, [templates, selectedId]);

  useEffect(() => {
    const id = selected?.id ? String(selected.id) : null;
    if (!id) return;
    if (prevSelectedIdRef.current === id) return;
    prevSelectedIdRef.current = id;
    setWizardStep(isDesigner ? 'canvas' : 'fields');
    setSelectedFieldId(null);
    const firstKey = String((Array.isArray(selectedPlaceholdersRef.current) ? selectedPlaceholdersRef.current : [])?.[0]?.key || '').trim();
    setAddOverlayKey(firstKey);
    setExpandedPlaceholderKey(firstKey || null);
  }, [selected?.id, isDesigner]);

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
    const keys = (Array.isArray(placeholders) ? placeholders : [])
      .map((p) => String(p?.key || '').trim())
      .filter((k) => k);
    if (keys.length === 0) {
      if (expandedPlaceholderKey) setExpandedPlaceholderKey(null);
      return;
    }
    const cur = String(expandedPlaceholderKey || '').trim();
    if (!cur || !keys.includes(cur)) setExpandedPlaceholderKey(keys[0]);
  }, [placeholders, expandedPlaceholderKey]);

  useEffect(() => {
    if (!selected?.id) return;
    const next = new Set();
    for (const b of Array.isArray(batches) ? batches : []) {
      if (String(b?.certificateTemplateId || '') === String(selected.id)) next.add(String(b.id));
    }
    setAssignedBatchIds(next);
  }, [batches, selected?.id]);

  useEffect(() => {
    if (!isDesigner) return;
    if (!selectedFieldId) return;
    setDesignerRightTab('inspector');
  }, [isDesigner, selectedFieldId]);

  if (isDesigner) {
    return (
      <div className="ac-page">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900">{t('canvasDesignerHeading')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('canvasDesignerSubheading')}</p>
        </div>

        {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="ac-card flex min-h-[70vh] flex-col p-3">
            {!selected ? (
              <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('selectTemplate')}</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-500">{t('certificateId')}</div>
                    <div className="text-sm font-semibold text-zinc-900">{String(selected?.certificateId || '').trim() || `#${selected.id}`}</div>
                    {String(selected?.name || '').trim() ? <div className="mt-0.5 text-[11px] text-zinc-500">{selected.name}</div> : null}
                    {saveStatus === 'saving' ? <div className="mt-0.5 text-[11px] font-semibold text-zinc-500">{t('saving')}</div> : null}
                    {saveStatus === 'saved' ? <div className="mt-0.5 text-[11px] font-semibold text-emerald-700">{t('saved')}</div> : null}
                    {saveStatus === 'error' ? <div className="mt-0.5 text-[11px] font-semibold text-rose-700">{t('saveFailed')}</div> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] font-semibold text-zinc-600">{t('contentLanguage')}</div>
                      <select
                        value={contentLang}
                        onChange={(e) => {
                          const next = String(e.target.value || 'en');
                          if (!next || next === contentLang) return;
                          if (selected?.id) flushPendingPatch(selected.id);
                          setContentLang(next);
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900"
                      >
                        <option value="en">EN</option>
                        <option value="ms">BM</option>
                        <option value="zh">中文</option>
                      </select>
                    </div>
                    {layoutLocked ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selected?.id) return;
                          await fillEmptyFromEn({ id: selected.id, lang: contentLang });
                          await fetchTemplate({ id: selected.id, lang: contentLang });
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                      >
                        {t('copyEnFillEmpty')}
                      </button>
                    ) : null}
                    <select value={addOverlayKey} onChange={(e) => setAddOverlayKey(e.target.value)} className="ac-input w-60 rounded-lg px-3 py-2 text-xs">
                      <option value="">{t('selectDataField')}</option>
                      {placeholders
                        .map((p) => ({ key: String(p?.key || '').trim(), label: String(stripHtmlToText(p?.labelHtml ?? p?.label ?? '') || '').trim() }))
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
                      disabled={layoutLocked || !validatePlaceholders.ok || !String(addOverlayKey || '').trim()}
                    >
                      {t('addToCanvas')}
                    </button>
                  </div>
                </div>

                {!validatePlaceholders.ok && validatePlaceholders.errors.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{validatePlaceholders.errors[0]}</div>
                ) : null}
                {layoutLocked ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{t('translateOnlyHint')}</div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDesignerZoomMode('fit')}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${designerZoomMode === 'fit' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'}`}
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDesignerZoomMode('custom');
                        setDesignerZoomPct(100);
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${designerZoomMode !== 'fit' && Number(designerZoomPct) === 100 ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'}`}
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDesignerZoomMode('custom');
                        setDesignerZoomPct((v) => clamp((Number(v) || 100) - 10, 25, 600));
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDesignerZoomMode('custom');
                        setDesignerZoomPct((v) => clamp((Number(v) || 100) + 10, 25, 600));
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      +
                    </button>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={25}
                        max={600}
                        step={5}
                        value={Number(designerZoomPct) || 100}
                        onChange={(e) => {
                          setDesignerZoomMode('custom');
                          setDesignerZoomPct(Number(e.target.value) || 100);
                        }}
                        className="w-40"
                        disabled={designerZoomMode === 'fit'}
                      />
                      <div className="text-xs font-semibold text-zinc-700">{Math.round((Number(canvasScale) || 1) * 100)}%</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDesignerRightTab('preview')}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${designerRightTab === 'preview' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'}`}
                    >
                      {t('preview')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDesignerRightTab('inspector')}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${designerRightTab === 'inspector' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'}`}
                    >
                      {t('inspector')}
                    </button>
                  </div>
                </div>

                <div ref={designerCanvasViewportRef} className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                  <CanvasStage
                    mode={layoutLocked ? 'select' : 'edit'}
                    width={canvasW}
                    height={canvasH}
                    scale={canvasScale}
                    backgroundMode={backgroundMode}
                    backgroundColor={canvasBgColor}
                    backgroundUrl={selected.background || ''}
                    items={canvasItems}
                    setItems={layoutLocked ? undefined : setCanvasItems}
                    selectedId={selectedFieldId}
                    setSelectedId={setSelectedFieldId}
                    grid={4}
                    largeUi={largeUi}
                    containerClassName="p-2"
                    containerStyle={{ height: '100%' }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex min-h-[70vh] flex-col rounded-xl border border-zinc-200 bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <button
                  type="button"
                  onClick={() => setDesignerRightTab('preview')}
                  className={`px-3 py-2 text-xs font-semibold ${designerRightTab === 'preview' ? 'bg-brand-50 text-brand-800' : 'text-zinc-700 hover:bg-zinc-50'}`}
                >
                  {t('preview')}
                </button>
                <button
                  type="button"
                  onClick={() => setDesignerRightTab('inspector')}
                  className={`px-3 py-2 text-xs font-semibold ${designerRightTab === 'inspector' ? 'bg-brand-50 text-brand-800' : 'text-zinc-700 hover:bg-zinc-50'}`}
                >
                  {t('inspector')}
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                <input type="checkbox" checked={largeUi} onChange={(e) => setLargeUi(Boolean(e.target.checked))} />
                {t('largeUi')}
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto pr-1">
              {designerRightTab === 'preview' ? (
                <>
                  <div className="mb-3 text-xs font-semibold text-zinc-500">{t('preview')}</div>
                  {!selected ? null : (
                    <div className="space-y-3">
                      <CanvasStage
                        mode="preview"
                        width={canvasW}
                        height={canvasH}
                        scale={Math.max(0.1, Math.min(2, 380 / Math.max(1, canvasW)))}
                        backgroundMode={backgroundMode}
                        backgroundColor={canvasBgColor}
                        backgroundUrl={selected.background || ''}
                        items={previewItems}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-3 text-xs font-semibold text-zinc-500">{t('inspector')}</div>
                  {!selected ? null : (
                    <div className="space-y-3">
                      <div>
                        <div className="mb-2 text-xs font-semibold text-zinc-500">{t('selectField')}</div>
                        {!selectedField ? (
                          <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">{t('selectField')}</div>
                        ) : (
                          <>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-zinc-600">x</label>
                                <input
                                  type="number"
                                  value={Number(selectedField.x) || 0}
                                  onChange={(e) => updateField({ x: Number(e.target.value) || 0 })}
                                  disabled={layoutLocked}
                                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-zinc-600">y</label>
                                <input
                                  type="number"
                                  value={Number(selectedField.y) || 0}
                                  onChange={(e) => updateField({ y: Number(e.target.value) || 0 })}
                                  disabled={layoutLocked}
                                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-zinc-600">w</label>
                                <input
                                  type="number"
                                  value={Number(selectedField.w) || 0}
                                  onChange={(e) => updateField({ w: Number(e.target.value) || 0 })}
                                  disabled={layoutLocked}
                                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-zinc-600">h</label>
                                <input
                                  type="number"
                                  value={Number(selectedField.h) || 0}
                                  onChange={(e) => updateField({ h: Number(e.target.value) || 0 })}
                                  disabled={layoutLocked}
                                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                                />
                              </div>
                            </div>

                            <div className="mt-3">
                              <label className="block text-xs font-medium text-zinc-700">{t('content')}</label>
                              <div className="mt-1">
                                {(() => {
                                  const path = String(selectedField.path || '');
                                  const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
                                  const ph = key ? placeholderByKey.get(key) : null;
                                  const source = String(ph?.source || '').trim();
                                  const isStaticLike = source === 'title' || source === 'static';
                                  const value = ph && isStaticLike ? String(ph?.staticValue || '') : String(selectedField.labelHtml ?? toQuillHtml(selectedField.label || ''));
                                  return (
                                    <RichTextEditor
                                      value={value}
                                      onChange={(html) => {
                                        const nextHtml = String(html || '');
                                        const nextText = String(stripHtmlToText(nextHtml) || '').trim();
                                        if (ph && isStaticLike) {
                                          updatePlaceholder(key, { staticValue: nextHtml });
                                          return;
                                        }
                                        if (ph && key) updatePlaceholder(key, { label: nextText, labelHtml: nextHtml });
                                        if (!layoutLocked) updateField({ label: nextText, labelHtml: nextHtml });
                                      }}
                                      minHeight="2.5rem"
                                      maxHeight={ph && isStaticLike ? '12rem' : '6rem'}
                                    />
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-zinc-700">{t('fontSize')}</label>
                                <input
                                  type="number"
                                  min={8}
                                  max={96}
                                  value={Number(selectedField.fontSize) > 0 ? Number(selectedField.fontSize) : 14}
                                  onChange={(e) => updateField({ fontSize: Number(e.target.value) || 14 })}
                                  disabled={layoutLocked}
                                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-zinc-700">{t('align')}</label>
                                <select
                                  value={String(selectedField.align || 'left')}
                                  onChange={(e) => updateField({ align: e.target.value })}
                                  disabled={layoutLocked}
                                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                                >
                                  <option value="left">{t('alignLeft')}</option>
                                  <option value="center">{t('alignCenter')}</option>
                                  <option value="right">{t('alignRight')}</option>
                                </select>
                              </div>
                            </div>

                            <label className="mt-3 flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={typeof selectedField.wrap === 'boolean' ? selectedField.wrap : true}
                                onChange={(e) => updateField({ wrap: e.target.checked })}
                                disabled={layoutLocked}
                              />
                              <span className="text-xs font-medium text-zinc-700">{t('wrapText')}</span>
                            </label>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = (Array.isArray(draftLayout) ? draftLayout : []).filter((f) => f.id !== selectedField.id);
                                  setSelectedFieldId(null);
                                  markLocalEdit();
                                  setDraftLayout(next);
                                  queueTemplatePatch({ layoutJson: next });
                                }}
                                disabled={layoutLocked}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                              >
                                {t('delete')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700">{t('certificateId')}</label>
                        <input
                          value={selected.certificateId || ''}
                          onChange={(e) => queueBasePatch({ certificateId: e.target.value })}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700">{t('certificateName')}</label>
                        <input
                          value={selected.name || ''}
                          onChange={(e) => queueBasePatch({ name: e.target.value })}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700">{t('backgroundUrl')}</label>
                        <input
                          value={selected.background || ''}
                          onChange={(e) => queueBasePatch({ background: e.target.value })}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            key={bgFileKey}
                            type="file"
                            accept="image/*,video/*"
                            disabled={layoutLocked}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setBgError(null);
                              setBgUploading(true);
                              try {
                                const res = await uploadMedia({ file });
                                queueBasePatch({ background: res?.url || '' });
                                setBgFileKey((k) => k + 1);
                              } catch (err) {
                                setBgError(err?.message || String(err));
                              } finally {
                                setBgUploading(false);
                              }
                            }}
                            className="text-xs"
                          />
                          <div className="text-[11px] text-zinc-500">{t('maxFileSize', { mb: MAX_UPLOAD_MB })}</div>
                          {bgUploading ? <div className="text-xs font-semibold text-zinc-500">{t('saving')}</div> : null}
                        </div>
                        {bgError ? <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{bgError}</div> : null}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700">{t('backgroundColor')}</label>
                        <input
                          value={selected.backgroundColor || ''}
                          onChange={(e) => queueBasePatch({ backgroundColor: e.target.value })}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700">{t('backgroundMode')}</label>
                        <select
                          value={backgroundMode}
                          onChange={(e) => {
                            const v = String(e.target.value || 'background');
                            setBackgroundMode(v);
                            queueBasePatch({ backgroundMode: v });
                          }}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="background">{t('stretchBackground')}</option>
                          <option value="fit">{t('fitBackground')}</option>
                          <option value="actual">{t('actualSize')}</option>
                        </select>
                        <div className="mt-1 text-[11px] text-zinc-500">{t('backgroundSizeAdvice')}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700">{t('canvasWidth')}</label>
                          <input
                            type="number"
                            value={canvasW}
                            onChange={(e) => queueBasePatch({ canvasWidth: Number(e.target.value) || 390 })}
                            disabled={layoutLocked}
                            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700">{t('canvasHeight')}</label>
                          <input
                            type="number"
                            value={canvasH}
                            onChange={(e) => queueBasePatch({ canvasHeight: Number(e.target.value) || 844 })}
                            disabled={layoutLocked}
                            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      {Array.isArray(batches) ? (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-zinc-500">{t('assignEpcBatches')}</div>
                          <div className="space-y-1">
                            {batches.map((b) => {
                              const bid = String(b?.id || '');
                              const checked = assignedBatchIds.has(bid);
                              return (
                                <label key={bid} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={layoutLocked}
                                    onChange={async (e) => {
                                      const next = new Set(Array.from(assignedBatchIds));
                                      if (e.target.checked) next.add(bid);
                                      else next.delete(bid);
                                      setAssignedBatchIds(next);
                                      await updateBatch({ id: b.id, certificateTemplateId: e.target.checked ? selected.id : null });
                                      void fetchBatches({ limit: 200, offset: 0 });
                                    }}
                                  />
                                  <div className="min-w-0 flex-1 truncate">
                                    {String(b?.batchNo || b?.code || `#${b?.id}`)} {b?.product?.code ? `(${b.product.code})` : ''}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                  <div className="text-xs font-semibold text-zinc-500">{t('certificateId')}</div>
                  <div className="text-sm font-semibold text-zinc-900">{String(selected?.certificateId || '').trim() || `#${selected.id}`}</div>
                  {String(selected?.name || '').trim() ? <div className="mt-0.5 text-[11px] text-zinc-500">{selected.name}</div> : null}
                  {saveStatus === 'saving' ? <div className="mt-0.5 text-[11px] font-semibold text-zinc-500">{t('saving')}</div> : null}
                  {saveStatus === 'saved' ? <div className="mt-0.5 text-[11px] font-semibold text-emerald-700">{t('saved')}</div> : null}
                  {saveStatus === 'error' ? <div className="mt-0.5 text-[11px] font-semibold text-rose-700">{t('saveFailed')}</div> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-semibold text-zinc-600">{t('contentLanguage')}</div>
                    <select
                      value={contentLang}
                      onChange={(e) => {
                        const next = String(e.target.value || 'en');
                        if (!next || next === contentLang) return;
                        if (selected?.id) flushPendingPatch(selected.id);
                        setContentLang(next);
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-900"
                    >
                      <option value="en">EN</option>
                      <option value="ms">BM</option>
                      <option value="zh">中文</option>
                    </select>
                  </div>
                  {layoutLocked ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selected?.id) return;
                        await fillEmptyFromEn({ id: selected.id, lang: contentLang });
                        await fetchTemplate({ id: selected.id, lang: contentLang });
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      {t('copyEnFillEmpty')}
                    </button>
                  ) : null}
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
                      <select value={addOverlayKey} onChange={(e) => setAddOverlayKey(e.target.value)} className="ac-input w-52 rounded-lg px-3 py-2 text-xs">
                        <option value="">{t('selectDataField')}</option>
                        {placeholders
                          .map((p) => ({ key: String(p?.key || '').trim(), label: String(stripHtmlToText(p?.labelHtml ?? p?.label ?? '') || '').trim() }))
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
                        disabled={layoutLocked || !String(addOverlayKey || '').trim()}
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
              {layoutLocked ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{t('translateOnlyHint')}</div>
              ) : null}

              {wizardStep === 'canvas' ? (
                <div ref={builderCanvasViewportRef} className="h-[calc(100vh-20rem)] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                  <CanvasStage
                    mode={layoutLocked ? 'select' : 'edit'}
                    width={canvasW}
                    height={canvasH}
                    scale={canvasScale}
                    backgroundMode={backgroundMode}
                    backgroundColor={canvasBgColor}
                    backgroundUrl={selected.background || ''}
                    items={canvasItems}
                    setItems={layoutLocked ? undefined : setCanvasItems}
                    selectedId={selectedFieldId}
                    setSelectedId={setSelectedFieldId}
                    grid={4}
                    containerClassName="p-2"
                    containerStyle={{ height: '100%' }}
                  />
                </div>
              ) : (
                <div className="flex max-h-[calc(100vh-20rem)] min-h-0 flex-col rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="text-xs font-semibold text-zinc-700">{t('step1DefineFields')}</div>
                  <div className="mt-2 text-sm text-zinc-600">{t('wizardFieldsHint')}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {t('dataFields')}: {placeholders.length}
                  </div>
                  <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                    {placeholders.map((p, idx) => {
                      const source = String(p?.source || 'static');
                      const uiSource = source === 'manual' ? 'static' : source;
                      const isTitle = uiSource === 'title';
                      const cardKey = String(p?.key || '').trim() || `idx-${idx}`;
                      const isOpen = String(expandedPlaceholderKey || '') === cardKey;
                      const title = String(stripHtmlToText(p?.labelHtml ?? p?.label ?? '') || '').trim() || String(p?.key || '').trim() || `#${idx + 1}`;
                      return (
                        <div key={`${p?.key || ''}-${idx}`} className="rounded-lg border border-zinc-200 bg-white p-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedPlaceholderKey(isOpen ? null : cardKey)}
                              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-zinc-50"
                            >
                              <div className="text-xs font-semibold text-zinc-500">{isOpen ? '▾' : '▸'}</div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-zinc-900">{title}</div>
                                <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                                  {uiSource === 'product'
                                    ? t('bindTo')
                                    : uiSource === 'title'
                                      ? t('sourceTitle')
                                      : uiSource === 'batch'
                                        ? t('sourceBatch')
                                        : t('sourceManual')}
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (layoutLocked) return;
                                const deletingKey = String(placeholders[idx]?.key || '').trim();
                                const deletingCardKey = deletingKey || `idx-${idx}`;
                                const nextPlaceholders = placeholders.filter((_, i) => i !== idx);
                                if (String(expandedPlaceholderKey || '') === deletingCardKey) {
                                  const nextExpanded = String(nextPlaceholders?.[0]?.key || '').trim();
                                  setExpandedPlaceholderKey(nextExpanded || null);
                                }
                                if (deletingKey) {
                                  const nextLayout = (Array.isArray(draftLayout) ? draftLayout : []).filter((it) => String(it?.path || '') !== `templateData.${deletingKey}`);
                                  if (String(addOverlayKey || '').trim() === deletingKey) setAddOverlayKey('');
                                  if (selectedField && String(selectedField.path || '') === `templateData.${deletingKey}`) setSelectedFieldId(null);
                                  replacePlaceholdersAndLayout({ nextPlaceholders, nextLayout });
                                  return;
                                }
                                replacePlaceholders(nextPlaceholders);
                              }}
                              disabled={layoutLocked}
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                            >
                              {t('delete')}
                            </button>
                          </div>
                          {isOpen ? (
                            <div className="mt-2 grid grid-cols-1 gap-2" onFocusCapture={() => setExpandedPlaceholderKey(cardKey)}>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                                  <input
                                    value={String(p?.label || stripHtmlToText(p?.labelHtml ?? '') || '')}
                                    onChange={(e) => {
                                      const nextLabel = String(e.target.value || '');
                                      const nextLabelHtml = toQuillHtml(nextLabel);
                                      const existingKey = String(p?.key || '').trim();
                                      if (layoutLocked) {
                                        if (existingKey) updatePlaceholder(existingKey, { label: nextLabel, labelHtml: nextLabelHtml });
                                        return;
                                      }
                                      const next = placeholders.slice();
                                      const cur = next[idx] || {};
                                      const curKey = String(cur.key || '').trim();
                                      if (!curKey) {
                                        const used = new Set(
                                          next
                                            .map((it, i) => (i === idx ? '' : String(it?.key || '').trim().toLowerCase()))
                                            .filter(Boolean)
                                        );
                                        const gen = makeUniqueKey(nextLabel.trim() || `field_${idx + 1}`, used);
                                        next[idx] = { ...cur, label: nextLabel, labelHtml: nextLabelHtml, key: gen };
                                      } else {
                                        next[idx] = { ...cur, label: nextLabel, labelHtml: nextLabelHtml };
                                      }
                                      replacePlaceholders(next);
                                      const nextKey = String(next[idx]?.key || '').trim();
                                      if (nextKey && String(expandedPlaceholderKey || '') === cardKey) setExpandedPlaceholderKey(nextKey);
                                    }}
                                    placeholder={t('fieldLabel')}
                                    className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={String((p?.separator ?? stripHtmlToText(p?.separatorHtml ?? '')) || ': ')}
                                    onChange={(e) => {
                                      const nextSep = String(e.target.value || '');
                                      const nextSepHtml = toQuillHtml(nextSep);
                                      const next = placeholders.slice();
                                      next[idx] = { ...(next[idx] || {}), separator: nextSep, separatorHtml: nextSepHtml };
                                      replacePlaceholders(next);
                                    }}
                                    placeholder={t('separator')}
                                    readOnly={isTitle}
                                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                                  />
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
                                  <select
                                    value={uiSource}
                                    onChange={(e) => {
                                      if (layoutLocked) return;
                                      const nextSource = e.target.value;
                                      const next = placeholders.slice();
                                      const cur = next[idx] || {};
                                      next[idx] = { ...cur, source: nextSource };
                                      replacePlaceholders(next);
                                    }}
                                    disabled={layoutLocked}
                                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                                  >
                                    <option value="static">{t('sourceManual')}</option>
                                    <option value="batch">{t('sourceBatch')}</option>
                                    <option value="title">{t('sourceTitle')}</option>
                                    <option value="product">{t('bindTo')}</option>
                                  </select>
                                  {uiSource === 'product' ? (
                                    <div className="min-w-0">
                                      <input
                                        value={String(p?.bindPath || '')}
                                        onChange={(e) => {
                                          if (layoutLocked) return;
                                          const next = placeholders.slice();
                                          next[idx] = { ...(next[idx] || {}), bindPath: e.target.value };
                                          replacePlaceholders(next);
                                        }}
                                        disabled={layoutLocked}
                                        placeholder={t('bindTo')}
                                        list="certTplBindPaths"
                                        className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                                      />
                                      <datalist id="certTplBindPaths">
                                        <option value="certificateId" />
                                        <option value="status" />
                                        <option value="issuedAt" />
                                        <option value="product.name" />
                                        <option value="product.sku" />
                                        <option value="product.code" />
                                        <option value="product.category" />
                                        <option value="product.origin" />
                                        <option value="product.description" />
                                        <option value="batch.batchNo" />
                                        <option value="epcItem.netWeight" />
                                        <option value="epcItem.caiqNumber" />
                                        <option value="epcItem.productionDate" />
                                      </datalist>
                                    </div>
                                  ) : (
                                    <div className="hidden sm:block" />
                                  )}
                                </div>
                              </div>
                              {uiSource === 'static' || uiSource === 'title' ? (
                                <div>
                                  <div className="mb-1 text-[11px] font-semibold text-zinc-600">{t('staticValue')}</div>
                                  <RichTextEditor
                                    value={String(p?.staticValue || '')}
                                    onChange={(v) => {
                                      const existingKey = String(p?.key || '').trim();
                                      if (layoutLocked) {
                                        if (existingKey) updatePlaceholder(existingKey, { staticValue: v });
                                        return;
                                      }
                                      const next = placeholders.slice();
                                      next[idx] = { ...(next[idx] || {}), staticValue: v };
                                      replacePlaceholders(next);
                                    }}
                                    minHeight="7rem"
                                    maxHeight="12rem"
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        (() => {
                          if (layoutLocked) return;
                          const used = new Set(
                            placeholders.map((it) => String(it?.key || '').trim().toLowerCase()).filter(Boolean)
                          );
                          const key = makeUniqueKey(`field_${placeholders.length + 1}`, used);
                          replacePlaceholders([...placeholders, { key, label: '', separator: ': ', source: 'static', bindPath: '', staticValue: '', sample: '' }]);
                          setExpandedPlaceholderKey(key);
                        })()
                      }
                      disabled={layoutLocked}
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
                <label className="block text-xs font-medium text-zinc-700">{t('certificateId')}</label>
                <input
                  value={selected.certificateId || ''}
                  onChange={(e) => queueBasePatch({ certificateId: e.target.value })}
                  disabled={layoutLocked}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('certificateName')}</label>
                <input
                  value={selected.name || ''}
                  onChange={(e) => queueBasePatch({ name: e.target.value })}
                  disabled={layoutLocked}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('backgroundUrl')}</label>
                <input
                  value={selected.background || ''}
                  onChange={(e) => void updateSelected({ background: e.target.value })}
                  disabled={layoutLocked}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                <div className="mt-2">
                  <label className="block text-xs font-medium text-zinc-700">{t('backgroundColor')}</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={canvasBgColor}
                      onChange={(e) => void updateSelected({ backgroundColor: e.target.value })}
                      disabled={layoutLocked}
                      className="h-10 w-14 rounded border border-zinc-200 bg-white p-1"
                    />
                    <input
                      value={canvasBgColor}
                      onChange={(e) => void updateSelected({ backgroundColor: e.target.value })}
                      disabled={layoutLocked}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-zinc-700">{t('backgroundMode')}</label>
                  <select
                    value={backgroundMode}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBackgroundMode(v);
                      queueBasePatch({ backgroundMode: v });
                    }}
                    disabled={layoutLocked}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="background">{t('stretchBackground')}</option>
                    <option value="fit">{t('fitBackground')}</option>
                    <option value="actual">{t('actualSize')}</option>
                  </select>
                  <div className="mt-1 text-[11px] text-zinc-500">{t('backgroundSizeAdvice')}</div>
                </div>
                <input
                  key={bgFileKey}
                  type="file"
                  accept="image/*,video/*"
                  disabled={layoutLocked || bgUploading}
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
                      const msg = err?.response?.data?.message || err?.message || t('uploadFailed');
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
                    disabled={layoutLocked}
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
                    disabled={layoutLocked}
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
                          disabled={layoutLocked}
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
                  disabled={layoutLocked}
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
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600">y</label>
                        <input
                          type="number"
                          value={Number(selectedField.y) || 0}
                          onChange={(e) => updateField({ y: Number(e.target.value) || 0 })}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600">w</label>
                        <input
                          type="number"
                          value={Number(selectedField.w) || 0}
                          onChange={(e) => updateField({ w: Number(e.target.value) || 0 })}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600">h</label>
                        <input
                          type="number"
                          value={Number(selectedField.h) || 0}
                          onChange={(e) => updateField({ h: Number(e.target.value) || 0 })}
                          disabled={layoutLocked}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700">{t('content')}</label>
                    <div className="mt-1">
                      {(() => {
                        const path = String(selectedField.path || '');
                        const key = path.startsWith('templateData.') ? path.slice('templateData.'.length) : '';
                        const ph = key ? placeholderByKey.get(key) : null;
                        const source = String(ph?.source || '').trim();
                        const isStaticLike = source === 'title' || source === 'static';
                        const value = ph && isStaticLike ? String(ph?.staticValue || '') : String(selectedField.labelHtml ?? toQuillHtml(selectedField.label || ''));
                        return (
                          <RichTextEditor
                            value={value}
                            onChange={(html) => {
                              const nextHtml = String(html || '');
                              const nextText = String(stripHtmlToText(nextHtml) || '').trim();
                              if (ph && isStaticLike) {
                                updatePlaceholder(key, { staticValue: nextHtml });
                                return;
                              }
                              if (ph && key) updatePlaceholder(key, { label: nextText, labelHtml: nextHtml });
                              if (!layoutLocked) updateField({ label: nextText, labelHtml: nextHtml });
                            }}
                            minHeight="2.5rem"
                            maxHeight={ph && isStaticLike ? '12rem' : '6rem'}
                          />
                        );
                      })()}
                    </div>
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
                        disabled={layoutLocked}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">{t('align')}</label>
                      <select
                        value={String(selectedField.align || 'left')}
                        onChange={(e) => updateField({ align: e.target.value })}
                        disabled={layoutLocked}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="left">{t('alignLeft')}</option>
                        <option value="center">{t('alignCenter')}</option>
                        <option value="right">{t('alignRight')}</option>
                      </select>
                    </div>
                  </div>

                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={typeof selectedField.wrap === 'boolean' ? selectedField.wrap : true}
                    onChange={(e) => updateField({ wrap: e.target.checked })}
                    disabled={layoutLocked}
                  />
                  <span className="text-xs font-medium text-zinc-700">{t('wrapText')}</span>
                </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (layoutLocked) return;
                        const next = (Array.isArray(draftLayout) ? draftLayout : []).filter((f) => f.id !== selectedField.id);
                        setSelectedFieldId(null);
                        markLocalEdit();
                        setDraftLayout(next);
                        queueTemplatePatch({ layoutJson: next });
                      }}
                      disabled={layoutLocked}
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
              <CanvasStage
                mode="preview"
                width={canvasW}
                height={canvasH}
                scale={Math.max(0.1, Math.min(2, 380 / Math.max(1, canvasW)))}
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
