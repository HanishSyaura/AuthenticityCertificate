import React, { useEffect, useMemo, useState } from 'react';
import useCmsStore from '../../store/useCmsStore';
import CmsPagePanel from '../../components/admin/cms/CmsPagePanel';
import CmsCanvasPanel from '../../components/admin/cms/CmsCanvasPanel';
import CmsInspectorPanel from '../../components/admin/cms/CmsInspectorPanel';
import { useT } from '../../i18n/useT';

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
    language,
    setLanguage,
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
    language: s.language,
    setLanguage: s.setLanguage,
    error: s.error
  }));

  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [viewMode, setViewMode] = useState('edit');

  const selectedPage = useMemo(
    () => pages.find((p) => String(p.id) === String(selectedPageId)) || null,
    [pages, selectedPageId]
  );

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
    fetchPages();
  }, [fetchPages]);

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

  const setLayout = (next) => {
    if (!selectedPageId) return;
    saveLayout({ pageId: selectedPageId, layoutJson: next, language });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('cmsHeading')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('cmsSubheading')}</p>
          {error ? <div className="mt-2 text-xs text-amber-700">{error}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900"
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
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            disabled={!selectedPageId}
          >
            Publish
          </button>
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === 'edit' ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'}`}
          >
            {t('edit')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold ${viewMode === 'preview' ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'}`}
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
          onCreatePage={async ({ name, slug }) => {
            const created = await createPage({ name, slug });
            selectPage(created.id);
            setSelectedBlockId(null);
          }}
        />

        <CmsCanvasPanel
          viewMode={viewMode}
          selectedPage={selectedPage}
          layout={layout}
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
