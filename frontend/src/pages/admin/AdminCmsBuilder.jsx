import React, { useEffect, useMemo, useState } from 'react';
import useCmsStore from '../../store/useCmsStore';
import CmsPagePanel from '../../components/admin/cms/CmsPagePanel';
import CmsCanvasPanel from '../../components/admin/cms/CmsCanvasPanel';
import CmsInspectorPanel from '../../components/admin/cms/CmsInspectorPanel';
import { useT } from '../../i18n/useT';

export default function AdminCmsBuilder({ kind = 'landing' }) {
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
    setKind,
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
    setKind: s.setKind,
    deletePage: s.deletePage,
    error: s.error
  }));

  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [viewMode, setViewMode] = useState('edit');

  const selectedPage = useMemo(
    () => pages.find((p) => String(p.id) === String(selectedPageId)) || null,
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

  const selectedBlock = useMemo(
    () => layout.find((b) => b.id === selectedBlockId) || null,
    [layout, selectedBlockId]
  );

  useEffect(() => {
    setKind(kind);
    fetchPages();
  }, [fetchPages, kind, setKind]);

  useEffect(() => {
    if (!selectedPageId && pages[0]?.id) {
      selectPage(pages[0].id);
    }
  }, [pages, selectPage, selectedPageId]);

  useEffect(() => {
    if (selectedPage) {
      loadLayoutForPage({ page: selectedPage });
    }
  }, [language, loadLayoutForPage, selectedPage]);

  useEffect(() => {
    if (viewMode !== 'preview') return;
    try {
      localStorage.setItem('ac_cms_preview', JSON.stringify({ layout, kind, language: language || 'en', ts: Date.now() }));
    } catch {
      void 0;
    }
  }, [kind, language, layout, viewMode]);

  const setLayout = (next) => {
    if (!selectedPageId) return;
    saveLayout({ pageId: selectedPageId, layoutJson: next, language });
  };

  return (
    <div className="ac-page">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{kind === 'certificate' ? t('cmsCertificateHeading') : t('cmsHeading')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{kind === 'certificate' ? t('cmsCertificateSubheading') : t('cmsSubheading')}</p>
          {error ? <div className="mt-2 text-xs text-amber-700">{error}</div> : null}
        </div>

        <div className="flex items-center gap-2">
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

        <CmsCanvasPanel
          viewMode={viewMode}
          kind={kind}
          selectedPage={selectedPage}
          layout={layout}
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
        />
      </div>
    </div>
  );
}
