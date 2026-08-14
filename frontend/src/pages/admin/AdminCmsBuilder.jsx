import React, { useEffect, useMemo, useRef, useState } from 'react';
import useCmsStore from '../../store/useCmsStore';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import CmsPagePanel from '../../components/admin/cms/CmsPagePanel';
import CmsCanvasPanel from '../../components/admin/cms/CmsCanvasPanel';
import CmsInspectorPanel from '../../components/admin/cms/CmsInspectorPanel';
import { useT } from '../../i18n/useT';

function getRect(block, mode) {
  const src = mode && block && typeof block === 'object' ? block[mode] || block : block;
  return {
    x: Number(src?.x ?? 0) || 0,
    y: Number(src?.y ?? 0) || 0,
    w: Number(src?.w ?? 0) || 0,
    h: Number(src?.h ?? 0) || 0
  };
}

function getLayoutHeight(layout) {
  if (!Array.isArray(layout)) return 0;
  let maxBottom = 0;
  for (const b of layout) {
    const rects = [getRect(b, null), getRect(b, 'desktop'), getRect(b, 'mobile')];
    for (const r of rects) {
      const bottom = (Number(r.y) || 0) + (Number(r.h) || 0);
      if (Number.isFinite(bottom)) maxBottom = Math.max(maxBottom, bottom);
    }
  }
  return maxBottom;
}

function shiftBlock(block, { yOffset, idPrefix }) {
  const next = { ...(block || {}) };
  if (next.id) next.id = `${idPrefix}${String(next.id)}`;
  if (next.x != null || next.y != null || next.w != null || next.h != null) {
    next.y = (Number(next.y) || 0) + yOffset;
  }
  if (next.desktop && typeof next.desktop === 'object') {
    next.desktop = { ...next.desktop, y: (Number(next.desktop.y) || 0) + yOffset };
  }
  if (next.mobile && typeof next.mobile === 'object') {
    next.mobile = { ...next.mobile, y: (Number(next.mobile.y) || 0) + yOffset };
  }
  return next;
}

function composeLayouts({ pages, layoutsByPageKey, language }) {
  const ordered = (Array.isArray(pages) ? pages : []).filter((p) => p && typeof p === 'object' && p.id != null);
  const byKey = layoutsByPageKey || {};
  const lang = language || 'en';
  let yOffset = 0;
  const out = [];
  for (const p of ordered) {
    const key = `${p.id}:${lang}`;
    const layout = byKey[key] || null;
    const arr = Array.isArray(layout) ? layout : [];
    const prefix = `p${String(p.id)}-`;
    for (const b of arr) out.push(shiftBlock(b, { yOffset, idPrefix: prefix }));
    yOffset += getLayoutHeight(arr);
  }
  return out;
}

export default function AdminCmsBuilder() {
  const { t } = useT();
  const {
    designs,
    selectedDesignId,
    setSelectedDesignId,
    fetchDesigns,
    createDesign,
    patchDesign,
    deleteDesign,
    materializeDefaultDesign,
    pages,
    layoutsByPageKey,
    selectedPageId,
    selectPage,
    fetchPages,
    createPage,
    loadLayoutForPage,
    saveLayout,
    publishPage,
    fillEmptyFromEn,
    reorderPages,
    language,
    setLanguage,
    deletePage,
    error
  } = useCmsStore((s) => ({
    designs: s.designs,
    selectedDesignId: s.selectedDesignId,
    setSelectedDesignId: s.setSelectedDesignId,
    fetchDesigns: s.fetchDesigns,
    createDesign: s.createDesign,
    patchDesign: s.patchDesign,
    deleteDesign: s.deleteDesign,
    materializeDefaultDesign: s.materializeDefaultDesign,
    pages: s.pages,
    layoutsByPageKey: s.layoutsByPageKey,
    selectedPageId: s.selectedPageId,
    selectPage: s.selectPage,
    fetchPages: s.fetchPages,
    createPage: s.createPage,
    loadLayoutForPage: s.loadLayoutForPage,
    saveLayout: s.saveLayout,
    publishPage: s.publishPage,
    fillEmptyFromEn: s.fillEmptyFromEn,
    reorderPages: s.reorderPages,
    language: s.language,
    setLanguage: s.setLanguage,
    deletePage: s.deletePage,
    error: s.error
  }));

  const { templates, fetchTemplates } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    fetchTemplates: s.fetchTemplates
  }));

  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [viewMode, setViewMode] = useState('split');
  const canvasWidth = 390;
  const canvasHeight = 844;

  // Design panel UI state
  const [designsOpen, setDesignsOpen] = useState(true);
  const [designNewName, setDesignNewName] = useState('');
  const [designNewSlug, setDesignNewSlug] = useState('');
  const [designNewDesc, setDesignNewDesc] = useState('');
  const [designShowCreate, setDesignShowCreate] = useState(false);
  const [designEditingId, setDesignEditingId] = useState(null);
  const [designEditName, setDesignEditName] = useState('');
  const [designEditSlug, setDesignEditSlug] = useState('');
  const [designEditDesc, setDesignEditDesc] = useState('');
  const [designDefaultRenameOpen, setDesignDefaultRenameOpen] = useState(false);
  const [designDefaultRenameName, setDesignDefaultRenameName] = useState('');
  const [designDefaultRenameSlug, setDesignDefaultRenameSlug] = useState('');
  const [designDefaultRenameDesc, setDesignDefaultRenameDesc] = useState('');

  const [pagesOpen, setPagesOpen] = useState(() => {
    try {
      return localStorage.getItem('ac_cms_pages_open_v1') !== '0';
    } catch {
      return true;
    }
  });
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    try {
      return localStorage.getItem('ac_cms_inspector_open_v1') !== '0';
    } catch {
      return true;
    }
  });
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [, setLastSavedAt] = useState(null);
  const saveSeqRef = useRef(0);
  const layoutLocked = String(language || 'en') !== 'en';

  const selectedPage = useMemo(
    () =>
      (Array.isArray(pages) ? pages : [])
        .filter((p) => p && typeof p === 'object' && p.id != null)
        .find((p) => String(p.id) === String(selectedPageId)) || null,
    [pages, selectedPageId]
  );

  const layoutLoaded = useMemo(() => {
    if (!selectedPageId) return false;
    const byKey = layoutsByPageKey || {};
    const key = `${selectedPageId}:${language || 'en'}`;
    return Object.prototype.hasOwnProperty.call(byKey, key) || Object.prototype.hasOwnProperty.call(byKey, String(selectedPageId));
  }, [language, layoutsByPageKey, selectedPageId]);

  const layout = useMemo(() => {
    if (!selectedPageId) return [];
    const key = `${selectedPageId}:${language || 'en'}`;
    return layoutsByPageKey[key] || [];
  }, [language, layoutsByPageKey, selectedPageId]);

  const previewLayout = useMemo(() => composeLayouts({ pages, layoutsByPageKey, language }), [language, layoutsByPageKey, pages]);

  const selectedBlock = useMemo(
    () => (Array.isArray(layout) ? layout : []).find((b) => b && b.id === selectedBlockId) || null,
    [layout, selectedBlockId]
  );

  useEffect(() => {
    void fetchDesigns({ kind: 'landing' });
  }, [fetchDesigns]);

  useEffect(() => {
    fetchPages({ kind: 'landing' });
  }, [fetchPages, selectedDesignId]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    const list = Array.isArray(pages) ? pages : [];
    const hasValidSelection = selectedPageId && list.some((p) => String(p.id) === String(selectedPageId));
    if (!hasValidSelection && list[0]?.id) {
      selectPage(list[0].id);
    }
  }, [pages, selectPage, selectedPageId]);

  useEffect(() => {
    if (selectedPage) {
      loadLayoutForPage({ page: selectedPage });
    }
  }, [language, loadLayoutForPage, selectedPage]);

  useEffect(() => {
    setSaveStatus('idle');
    setSaveError(null);
    setLastSavedAt(null);
  }, [selectedPageId]);

  useEffect(() => {
    if (viewMode !== 'preview' && viewMode !== 'split') return;
    let cancelled = false;
    (async () => {
      for (const p of pages || []) {
        if (cancelled) return;
        await loadLayoutForPage({ page: p });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLayoutForPage, pages, viewMode]);

  useEffect(() => {
    if (viewMode !== 'preview' && viewMode !== 'split') return;
    try {
      const toStore = previewLayout?.length ? previewLayout : layout;
      localStorage.setItem('ac_cms_preview', JSON.stringify({ layout: toStore, kind: 'landing', language: language || 'en', ts: Date.now() }));
    } catch {
      void 0;
    }
  }, [language, layout, previewLayout, viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('ac_cms_pages_open_v1', pagesOpen ? '1' : '0');
    } catch {
      void 0;
    }
  }, [pagesOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('ac_cms_inspector_open_v1', inspectorOpen ? '1' : '0');
    } catch {
      void 0;
    }
  }, [inspectorOpen]);

  const setLayout = (next) => {
    if (!selectedPageId) return;
    const seq = (saveSeqRef.current += 1);
    setSaveStatus('saving');
    setSaveError(null);
    Promise.resolve(saveLayout({ pageId: selectedPageId, layoutJson: next, language }))
      .then(() => {
        if (saveSeqRef.current !== seq) return;
        setSaveStatus('saved');
        setLastSavedAt(Date.now());
      })
      .catch((e) => {
        if (saveSeqRef.current !== seq) return;
        setSaveStatus('error');
        setSaveError(e?.message || t('saveFailed'));
      });
  };

  const gridCols =
    pagesOpen && inspectorOpen
      ? 'lg:grid-cols-[220px_1fr_260px]'
      : pagesOpen
        ? 'lg:grid-cols-[220px_1fr]'
        : inspectorOpen
          ? 'lg:grid-cols-[1fr_260px]'
          : 'lg:grid-cols-1';

  return (
    <div className="p-3 sm:p-4 lg:p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div data-tour="cms-header">
          <h2 className="text-base font-semibold text-zinc-900">{t('cmsHeading')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('cmsSubheading')}</p>
          {error ? <div className="mt-2 text-xs text-amber-700">{error}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saving' ? <div className="text-xs font-semibold text-zinc-500">{t('saving')}</div> : null}
          {saveStatus === 'saved' ? <div className="text-xs font-semibold text-emerald-700">{t('saved')}</div> : null}
          {saveStatus === 'error' ? <div className="text-xs font-semibold text-rose-700">{t('saveFailed')}</div> : null}
          <select
            className="ac-input rounded-lg px-3 py-2 text-xs font-semibold"
            value={language || 'en'}
            onChange={(e) => setLanguage(e.target.value)}
            data-tour="cms-language"
          >
            <option value="en">EN</option>
            <option value="ms">BM</option>
            <option value="zh">中文</option>
          </select>
          {layoutLocked ? (
            <button
              type="button"
              onClick={async () => {
                if (!selectedPageId) return;
                await fillEmptyFromEn({ pageId: selectedPageId, language });
                await loadLayoutForPage({ page: selectedPage });
              }}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              disabled={!selectedPageId || saveStatus === 'saving'}
            >
              {t('copyEnFillEmpty')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              if (!selectedPageId) return;
              const seq = (saveSeqRef.current += 1);
              setSaveStatus('saving');
              setSaveError(null);
              try {
                await saveLayout({ pageId: selectedPageId, layoutJson: layout, language });
                if (saveSeqRef.current !== seq) return;
                setSaveStatus('saved');
                setLastSavedAt(Date.now());
              } catch (e) {
                if (saveSeqRef.current !== seq) return;
                setSaveStatus('error');
                setSaveError(e?.message || t('saveFailed'));
              }
            }}
            className="ac-btn rounded-lg px-3 py-2 text-xs"
            disabled={!selectedPageId || saveStatus === 'saving'}
            data-tour="cms-save"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!selectedPageId) return;
              await publishPage({ pageId: selectedPageId });
            }}
            className="ac-btn rounded-lg px-3 py-2 text-xs"
            disabled={!selectedPageId || layoutLocked}
            data-tour="cms-publish"
          >
            {t('publish')}
          </button>
          {!pagesOpen ? (
            <button
              type="button"
              onClick={() => setPagesOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              title={`${t('expand')} ${t('pages')}`}
            >
              <span className="hidden xl:inline">{t('pages')}</span>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4 3.5A1.5 1.5 0 0 0 2.5 5v10A1.5 1.5 0 0 0 4 16.5h12A1.5 1.5 0 0 0 17.5 15V5A1.5 1.5 0 0 0 16 3.5H4Zm2.5 1H4.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h2V4.5Zm1.5.5A.5.5 0 0 1 8.5 4.5h7A.5.5 0 0 1 16 5v10a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5V5Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : null}
          {!inspectorOpen ? (
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              title={`${t('expand')} ${t('inspector')}`}
            >
              <span className="hidden xl:inline">{t('inspector')}</span>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M4 3.5A1.5 1.5 0 0 0 2.5 5v10A1.5 1.5 0 0 0 4 16.5h12A1.5 1.5 0 0 0 17.5 15V5A1.5 1.5 0 0 0 16 3.5H4Zm10.5 1H16a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5h-1.5V4.5Zm-1.5.5A.5.5 0 0 0 12.5 4.5h-7A.5.5 0 0 0 5 5v10a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V5Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              viewMode === 'edit' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200/80 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {t('edit')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              viewMode === 'split' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200/80 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {t('split')}
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('preview');
            }}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              viewMode === 'preview' ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'border border-zinc-200/80 bg-white text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            {t('preview')}
          </button>
        </div>
      </div>

      <div className={`relative grid grid-cols-1 gap-3 ${gridCols}`}>
        {!pagesOpen ? (
          <button
            type="button"
            onClick={() => setPagesOpen(true)}
            className="hidden lg:inline-flex absolute left-0 top-1/2 z-10 -translate-y-1/2 items-center justify-center rounded-r-lg border border-zinc-200 bg-white px-2 py-3 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title={`${t('expand')} ${t('pages')}`}
          >
            <span aria-hidden="true">{'>'}</span>
          </button>
        ) : null}
        {!inspectorOpen ? (
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="hidden lg:inline-flex absolute right-0 top-1/2 z-10 -translate-y-1/2 items-center justify-center rounded-l-lg border border-zinc-200 bg-white px-2 py-3 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title={`${t('expand')} ${t('inspector')}`}
          >
            <span aria-hidden="true">{'<'}</span>
          </button>
        ) : null}
        {pagesOpen ? (
          <div data-tour="cms-panels-left" className="flex flex-col gap-3">
            {/* =======================================================
                CmsDesignPanel — Top-level landing design bundle selector
                ======================================================= */}
            <div className="ac-card p-3">
              <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-900">
                    {t('landingDesigns')}
                    <span className="ml-2 text-[10px] font-normal text-zinc-500">
                      {selectedDesignId == null
                        ? `(${t('defaultGroup')} — ${pages?.length || 0} ${t('pages')})`
                        : `(${pages?.length || 0} ${t('pages')})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDesignsOpen((v) => !v)}
                    className="text-xs text-zinc-500 hover:text-zinc-800"
                    aria-label="Toggle designs"
                  >
                    {designsOpen ? '▾' : '▸'}
                  </button>
                </div>

                {designsOpen ? (
                  <>
                    {/* Default (legacy) group option — pages with designId = NULL */}
                    {designDefaultRenameOpen ? (
                      <div className="mb-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2">
                        <div className="text-[11px] font-medium text-amber-900">{t('renameDefaultDesign')}</div>
                        <p className="text-[10px] leading-snug text-amber-800">{t('renameDefaultDesignHint')}</p>
                        <input
                          className="ac-input !py-1 text-[11px]"
                          placeholder={`${t('name')} — e.g. Old Landing Pages`}
                          value={designDefaultRenameName}
                          onChange={(e) => setDesignDefaultRenameName(e.target.value)}
                        />
                        <input
                          className="ac-input !py-1 text-[11px]"
                          placeholder={`slug (${t('optional')}) — e.g. old-default`}
                          value={designDefaultRenameSlug}
                          onChange={(e) => setDesignDefaultRenameSlug(e.target.value)}
                        />
                        <textarea
                          className="ac-input !py-1 text-[11px] h-12"
                          placeholder={`${t('description')} (${t('optional')})`}
                          value={designDefaultRenameDesc}
                          onChange={(e) => setDesignDefaultRenameDesc(e.target.value)}
                        />
                        <div className="flex justify-end gap-1 pt-1">
                          <button
                            type="button"
                            className="ac-btn ac-btn-soft !px-2 !py-1 text-[10px]"
                            onClick={() => {
                              setDesignDefaultRenameOpen(false);
                              setDesignDefaultRenameName('');
                              setDesignDefaultRenameSlug('');
                              setDesignDefaultRenameDesc('');
                            }}
                          >
                            {t('cancel')}
                          </button>
                          <button
                            type="button"
                            className="ac-btn !px-2 !py-1 text-[10px]"
                            onClick={async () => {
                              const name = String(designDefaultRenameName || '').trim();
                              if (!name) return;
                              try {
                                const row = await materializeDefaultDesign({
                                  name,
                                  slug: designDefaultRenameSlug || undefined,
                                  kind: 'landing',
                                  description: designDefaultRenameDesc ? String(designDefaultRenameDesc).trim() : undefined
                                });
                                setDesignDefaultRenameOpen(false);
                                setDesignDefaultRenameName('');
                                setDesignDefaultRenameSlug('');
                                setDesignDefaultRenameDesc('');
                                if (row?.id != null) {
                                  setSelectedDesignId(row.id);
                                  void fetchPages({ kind: 'landing' });
                                }
                              } catch {
                                /* handled globally */
                              }
                            }}
                          >
                            {t('rename')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`mb-1 group rounded-md transition ${
                          selectedDesignId == null ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedDesignId(null)}
                            className={`flex-1 min-w-0 px-2 py-1.5 text-left text-xs ${
                              selectedDesignId == null ? 'font-semibold text-brand-900' : 'text-zinc-800'
                            }`}
                          >
                            <div className="truncate">{t('defaultDesign')}</div>
                            <div className="truncate text-[10px] text-zinc-500">{t('legacy')}</div>
                          </button>
                          <button
                            type="button"
                            className="mr-1 rounded px-2 py-0.5 text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 hover:text-zinc-900"
                            title={t('renameDefaultDesign')}
                            onClick={() => {
                              setDesignDefaultRenameOpen(true);
                              setDesignDefaultRenameName(t('defaultDesign'));
                              setDesignDefaultRenameSlug('default');
                              setDesignDefaultRenameDesc('');
                            }}
                          >
                            {t('rename')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Created CmsDesign bundles */}
                    {(designs || []).map((d) => {
                      const active = String(d.id) === String(selectedDesignId);
                      const editing = String(designEditingId) === String(d.id);
                      if (editing) {
                        return (
                          <div key={`edit-${d.id}`} className="mb-1 space-y-1 rounded-md border border-zinc-200 bg-white p-2">
                            <input
                              className="ac-input !py-1 text-[11px]"
                              placeholder={t('name')}
                              value={designEditName}
                              onChange={(e) => setDesignEditName(e.target.value)}
                            />
                            <input
                              className="ac-input !py-1 text-[11px]"
                              placeholder="slug"
                              value={designEditSlug}
                              onChange={(e) => setDesignEditSlug(e.target.value)}
                            />
                            <textarea
                              className="ac-input !py-1 text-[11px] h-12"
                              placeholder={t('description')}
                              value={designEditDesc}
                              onChange={(e) => setDesignEditDesc(e.target.value)}
                            />
                            <div className="flex justify-end gap-1 pt-1">
                              <button
                                type="button"
                                className="ac-btn ac-btn-soft !px-2 !py-1 text-[10px]"
                                onClick={() => {
                                  setDesignEditingId(null);
                                  setDesignEditName('');
                                  setDesignEditSlug('');
                                  setDesignEditDesc('');
                                }}
                              >
                                {t('cancel')}
                              </button>
                              <button
                                type="button"
                                className="ac-btn !px-2 !py-1 text-[10px]"
                                onClick={async () => {
                                  try {
                                    await patchDesign({
                                      id: d.id,
                                      name: designEditName || undefined,
                                      slug: designEditSlug || undefined,
                                      description: designEditDesc === '' ? null : designEditDesc
                                    });
                                    setDesignEditingId(null);
                                    setDesignEditName('');
                                    setDesignEditSlug('');
                                    setDesignEditDesc('');
                                  } catch {
                                    /* handled globally */
                                  }
                                }}
                              >
                                {t('save')}
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={d.id}
                          className={`mb-1 group rounded-md transition ${
                            active ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-zinc-50'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedDesignId(d.id)}
                              className={`flex-1 min-w-0 px-2 py-1.5 text-left text-xs ${
                                active ? 'font-semibold text-brand-900' : 'text-zinc-800'
                              }`}
                            >
                              <div className="truncate">{d.name}</div>
                              <div className="truncate text-[10px] text-zinc-500">
                                {d.slug}
                                {d.published ? ' · published' : ' · draft'}
                              </div>
                            </button>
                            <button
                              type="button"
                              className="rounded px-2 py-0.5 text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 hover:text-zinc-900"
                              title={t('edit')}
                              onClick={() => {
                                setDesignEditingId(d.id);
                                setDesignEditName(d.name || '');
                                setDesignEditSlug(d.slug || '');
                                setDesignEditDesc(d.description || '');
                              }}
                            >
                              {t('edit')}
                            </button>
                            <button
                              type="button"
                              className="mr-1 rounded px-2 py-0.5 text-[10px] text-rose-500 opacity-0 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-800"
                              title={t('delete')}
                              onClick={async () => {
                                const confirmMsg =
                                  typeof window !== 'undefined'
                                    ? window.confirm(
                                        `${String(t('confirmDelete') || 'Delete this design bundle?')}\n${String(
                                          t('pagesWillMoveToDefault') || 'Inner pages will be moved to Default group.'
                                        )}`
                                      )
                                    : true;
                                if (!confirmMsg) return;
                                try {
                                  await deleteDesign({ id: d.id });
                                } catch {
                                  /* ignore */
                                }
                              }}
                            >
                              {t('delete')}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Create new design */}
                    {designShowCreate ? (
                      <div className="mt-2 space-y-1 rounded-md border border-zinc-200 bg-white p-2">
                        <input
                          className="ac-input !py-1 text-[11px]"
                          placeholder={`${t('name')} — e.g. Sarang Madu Landing`}
                          value={designNewName}
                          onChange={(e) => setDesignNewName(e.target.value)}
                        />
                        <input
                          className="ac-input !py-1 text-[11px]"
                          placeholder="slug — e.g. sarang-madu"
                          value={designNewSlug}
                          onChange={(e) => setDesignNewSlug(e.target.value)}
                        />
                        <textarea
                          className="ac-input !py-1 text-[11px] h-12"
                          placeholder={`${t('description')} (${t('optional')})`}
                          value={designNewDesc}
                          onChange={(e) => setDesignNewDesc(e.target.value)}
                        />
                        <div className="flex justify-end gap-1 pt-1">
                          <button
                            type="button"
                            className="ac-btn ac-btn-soft !px-2 !py-1 text-[10px]"
                            onClick={() => {
                              setDesignShowCreate(false);
                              setDesignNewName('');
                              setDesignNewSlug('');
                              setDesignNewDesc('');
                            }}
                          >
                            {t('cancel')}
                          </button>
                          <button
                            type="button"
                            className="ac-btn !px-2 !py-1 text-[10px]"
                            onClick={async () => {
                              const name = String(designNewName || '').trim();
                              if (!name) return;
                              try {
                                await createDesign({
                                  name,
                                  slug: designNewSlug || undefined,
                                  kind: 'landing',
                                  description: designNewDesc ? String(designNewDesc).trim() : undefined
                                });
                                setDesignShowCreate(false);
                                setDesignNewName('');
                                setDesignNewSlug('');
                                setDesignNewDesc('');
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            {t('create')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 w-full rounded-md border border-dashed border-zinc-300 px-2 py-1.5 text-[11px] text-zinc-500 hover:border-zinc-500 hover:text-zinc-800"
                        onClick={() => setDesignShowCreate(true)}
                      >
                        + {t('addDesign')}
                      </button>
                    )}
                  </>
                ) : null}
              </div>

            {/* =====================================================
                CmsPagePanel — inner pages/sections WITHIN currently selected design bundle
                ===================================================== */}
            <div data-tour="cms-pages-panel">
              <CmsPagePanel
                pages={pages}
                selectedPageId={selectedPageId}
                onSelectPage={(id) => {
                  selectPage(id);
                  setSelectedBlockId(null);
                }}
                onCollapse={() => setPagesOpen(false)}
                onReorderPages={async (orderedIds) => {
                  await reorderPages({ orderedIds });
                }}
                onCreatePage={async ({ name, slug }) => {
                  const created = await createPage({ name, slug });
                  selectPage(created.id);
                  setSelectedBlockId(null);
                }}
                onDeletePage={async (id) => {
                  await deletePage({ pageId: id });
                  setSelectedBlockId(null);
                }}
              />
            </div>
          </div>
        ) : null}

        {saveError ? <div className="col-span-full -mt-2 text-xs text-rose-700">{saveError}</div> : null}

        <div data-tour="cms-canvas-panel">
          <CmsCanvasPanel
            viewMode={viewMode}
            kind="landing"
            selectedPage={selectedPage}
            layout={layout}
            previewLayout={previewLayout}
            layoutLoaded={layoutLoaded}
            setLayout={setLayout}
            selectedBlockId={selectedBlockId}
            setSelectedBlockId={setSelectedBlockId}
            layoutLocked={layoutLocked}
          />
        </div>

        {inspectorOpen ? (
          <div data-tour="cms-inspector-panel">
            <CmsInspectorPanel
              selectedBlock={selectedBlock}
              layout={layout}
              setLayout={setLayout}
              clearSelection={() => setSelectedBlockId(null)}
              templates={templates}
              layoutLocked={layoutLocked}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              grid={4}
              onCollapse={() => setInspectorOpen(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
