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
  const ordered = Array.isArray(pages) ? pages : [];
  const byKey = layoutsByPageKey || {};
  const lang = language || 'en';
  let yOffset = 0;
  const out = [];
  for (const p of ordered) {
    const key = `${p.id}:${lang}`;
    const layout = byKey[key] || byKey[String(p.id)] || null;
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
    pages,
    layoutsByPageKey,
    selectedPageId,
    selectPage,
    fetchPages,
    createPage,
    loadLayoutForPage,
    saveLayout,
    publishPage,
    reorderPages,
    language,
    setLanguage,
    deletePage,
    error
  } = useCmsStore((s) => ({
    pages: s.pages,
    layoutsByPageKey: s.layoutsByPageKey,
    selectedPageId: s.selectedPageId,
    selectPage: s.selectPage,
    fetchPages: s.fetchPages,
    createPage: s.createPage,
    loadLayoutForPage: s.loadLayoutForPage,
    saveLayout: s.saveLayout,
    publishPage: s.publishPage,
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
  const [viewMode, setViewMode] = useState('edit');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [, setLastSavedAt] = useState(null);
  const saveSeqRef = useRef(0);

  const selectedPage = useMemo(
    () => (Array.isArray(pages) ? pages : []).find((p) => String(p.id) === String(selectedPageId)) || null,
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
    return layoutsByPageKey[key] || layoutsByPageKey[String(selectedPageId)] || [];
  }, [language, layoutsByPageKey, selectedPageId]);

  const previewLayout = useMemo(() => composeLayouts({ pages, layoutsByPageKey, language }), [language, layoutsByPageKey, pages]);

  const selectedBlock = useMemo(
    () => (Array.isArray(layout) ? layout : []).find((b) => b && b.id === selectedBlockId) || null,
    [layout, selectedBlockId]
  );

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    const list = Array.isArray(pages) ? pages : [];
    if (!selectedPageId && list[0]?.id) {
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
    if (viewMode !== 'preview') return;
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
    if (viewMode !== 'preview') return;
    try {
      const toStore = previewLayout?.length ? previewLayout : layout;
      localStorage.setItem('ac_cms_preview', JSON.stringify({ layout: toStore, kind: 'landing', language: language || 'en', ts: Date.now() }));
    } catch {
      void 0;
    }
  }, [language, layout, previewLayout, viewMode]);

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
        setSaveError(e?.message || 'Failed to save');
      });
  };

  return (
    <div className="ac-page">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
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
          >
            <option value="en">EN</option>
            <option value="ms">BM</option>
            <option value="zh">中文</option>
          </select>
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
                setSaveError(e?.message || 'Failed to save');
              }
            }}
            className="ac-btn rounded-lg px-3 py-2 text-xs"
            disabled={!selectedPageId || saveStatus === 'saving'}
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
            disabled={!selectedPageId}
          >
            Publish
          </button>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_280px]">
        <CmsPagePanel
          pages={pages}
          selectedPageId={selectedPageId}
          onSelectPage={(id) => {
            selectPage(id);
            setSelectedBlockId(null);
          }}
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

        {saveError ? <div className="lg:col-span-3 -mt-2 text-xs text-rose-700">{saveError}</div> : null}

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
        />

        <CmsInspectorPanel
          selectedBlock={selectedBlock}
          layout={layout}
          setLayout={setLayout}
          clearSelection={() => setSelectedBlockId(null)}
          templates={templates}
        />
      </div>
    </div>
  );
}
