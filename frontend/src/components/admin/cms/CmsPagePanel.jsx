import React, { useState } from 'react';
import { useT } from '../../../i18n/useT';

export default function CmsPagePanel({
  pages,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onReorderPages,
  onCollapse
}) {
  const { t } = useT();
  const [pageName, setPageName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingPageId, setEditingPageId] = useState(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentListPage, setCurrentListPage] = useState(1);
  const pagesPerListPage = 5;

  const pageList = (Array.isArray(pages) ? pages : [])
    .filter((page) => page && typeof page === 'object');

  const totalListPages = Math.max(
    1,
    Math.ceil(pageList.length / pagesPerListPage)
  );
  const safeListPage = Math.min(currentListPage, totalListPages);
  const visiblePages = pageList.slice(
    (safeListPage - 1) * pagesPerListPage,
    safeListPage * pagesPerListPage
  );

  const slugify = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');

  // Remove the legacy auto-generated "Page N - " prefix for display.
  const getDisplayName = (value) =>
    String(value || '').replace(/^Page\s+\d+\s*[-:]\s*/i, '').trim()
      || String(value || 'Untitled Page');

  const beginRename = (page) => {
    setEditingPageId(page.id);
    setEditingPageName(getDisplayName(page.name));
    setRenameError('');
  };

  const cancelRename = () => {
    if (renaming) return;
    setEditingPageId(null);
    setEditingPageName('');
    setRenameError('');
  };

  const saveRename = async (event, page) => {
    event.preventDefault();
    const name = editingPageName.trim();
    if (!name) {
      setRenameError('Page name is required.');
      return;
    }
    if (name.length > 120) {
      setRenameError('Page name must not exceed 120 characters.');
      return;
    }
    if (renaming) return;

    try {
      setRenaming(true);
      setRenameError('');
      await onRenamePage(page.id, name);
      setEditingPageId(null);
      setEditingPageName('');
    } catch (error) {
      setRenameError(error?.message || 'Unable to rename page.');
    } finally {
      setRenaming(false);
    }
  };

  const create = async () => {
    const name = pageName.trim();
    if (!name || creating) return;

    const base = slugify(name) || 'page';
    let slug = base;
    let suffix = 2;

    while (pageList.some((page) => String(page.slug || '').toLowerCase() === slug.toLowerCase())) {
      slug = `${base}-${suffix++}`;
    }

    try {
      setCreating(true);
      await onCreatePage({
        name,
        slug,
        description: description.trim()
      });
      setPageName('');
      setDescription('');
      setShowCreateModal(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            {t('pages')}
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-900">
            {pageList.length} {t('pages')}
          </div>
        </div>

        {typeof onCollapse === 'function' && (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title={t('collapse')}
          >
            <span aria-hidden="true">&lt;</span>
            <span>{t('collapse')}</span>
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {visiblePages.map((page) => {
          const idx = pageList.findIndex(
            (item) => String(item.id) === String(page.id)
          );
          const selected = String(page.id) === String(selectedPageId);
          const isFirst = idx === 0;
          const isLast = idx === pageList.length - 1;

          return (
            <div
              key={page.id}
              className={`rounded-lg border px-2.5 py-2 transition ${
                selected
                  ? 'border-brand-200 bg-brand-50/80 text-brand-900 shadow-sm'
                  : 'border-zinc-200 bg-zinc-50/60 text-zinc-900 hover:border-zinc-300 hover:bg-white'
              }`}
            >
              {String(editingPageId) === String(page.id) ? (
                <form onSubmit={(event) => saveRename(event, page)} className="space-y-2">
                  <label htmlFor={`cms-rename-page-${page.id}`} className="sr-only">
                    Rename page
                  </label>
                  <input
                    id={`cms-rename-page-${page.id}`}
                    autoFocus
                    value={editingPageName}
                    onChange={(event) => setEditingPageName(event.target.value)}
                    maxLength={120}
                    disabled={renaming}
                    className="ac-input w-full rounded-md border-zinc-200 bg-white px-2 py-1.5 text-xs"
                    aria-label="Page name"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      disabled={renaming || !editingPageName.trim()}
                      className="rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {renaming ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={renaming}
                      onClick={cancelRename}
                      className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {renameError ? (
                    <p role="alert" className="text-[11px] leading-4 text-red-600">
                      {renameError}
                    </p>
                  ) : null}
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectPage(page.id)}
                  className="block w-full min-w-0 text-left"
                  aria-current={selected ? 'page' : undefined}
                >
                  <div
                    className="whitespace-normal break-words text-xs font-semibold leading-4"
                    title={getDisplayName(page.name)}
                  >
                    {getDisplayName(page.name)}
                  </div>
                </button>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-200/80 pt-1.5">
                <div className="flex shrink-0 items-center gap-1">
                  {onReorderPages && (
                    <>
                      <button
                        type="button"
                        title={t('moveUp')}
                        aria-label={`Move ${getDisplayName(page.name)} up`}
                        disabled={isFirst}
                        onClick={() => {
                          if (isFirst) return;
                          const ids = pageList.map((item) => item.id);
                          [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                          onReorderPages(ids);
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                          <path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        title={t('moveDown')}
                        aria-label={`Move ${getDisplayName(page.name)} down`}
                        disabled={isLast}
                        onClick={() => {
                          if (isLast) return;
                          const ids = pageList.map((item) => item.id);
                          [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                          onReorderPages(ids);
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                          <path d="M10 5v10m4.5-4.5L10 15l-4.5-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </>
                  )}

                  {onRenamePage && String(editingPageId) !== String(page.id) && (
                    <button
                      type="button"
                      title="Rename page"
                      aria-label={`Rename ${getDisplayName(page.name)}`}
                      onClick={() => beginRename(page)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path d="m12.8 4.2 3 3M4 16l3.8-.8L16 7a1.8 1.8 0 0 0-3-3l-8.2 8.2L4 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}

                  {onDeletePage && (
                    <button
                      type="button"
                      title={t('delete')}
                      aria-label={`Delete ${getDisplayName(page.name)}`}
                      onClick={() => {
                        if (window.confirm(t('confirmDelete'))) {
                          onDeletePage(page.id);
                        }
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path d="M4.5 6h11M8 6V4.5h4V6m-6.5 0 .7 9.2c.1.8.5 1.3 1.3 1.3h5c.8 0 1.2-.5 1.3-1.3L14.5 6M8.2 8.5v5m3.6-5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalListPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-1 border-t border-zinc-100 pt-3">
          <button
            type="button"
            onClick={() => setCurrentListPage((current) => Math.max(1, current - 1))}
            disabled={safeListPage === 1}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <div className="flex items-center gap-1" aria-label="Landing page list pagination">
            {Array.from({ length: totalListPages }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setCurrentListPage(number)}
                aria-current={safeListPage === number ? 'page' : undefined}
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition ${
                  safeListPage === number
                    ? 'bg-zinc-900 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {number}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCurrentListPage((current) => Math.min(totalListPages, current + 1))}
            disabled={safeListPage === totalListPages}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        className="ac-btn mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm shadow-sm"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Add Landing Page
      </button>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) {
              setShowCreateModal(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cms-create-page-title"
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="cms-create-page-title"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Add Landing Page
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Enter the name and description for your new page.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                title="Close"
                disabled={creating}
                onClick={() => setShowCreateModal(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                create();
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="cms-page-name"
                  className="mb-1.5 block text-sm font-medium text-zinc-700"
                >
                  Page Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="cms-page-name"
                  name="pageName"
                  autoFocus
                  required
                  value={pageName}
                  onChange={(event) => setPageName(event.target.value)}
                  maxLength={120}
                  className="ac-input w-full rounded-lg border-zinc-200 bg-white px-3 py-2.5"
                  placeholder="Enter page name"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-page-description"
                  className="mb-1.5 block text-sm font-medium text-zinc-700"
                >
                  Description
                </label>
                <textarea
                  id="cms-page-description"
                  name="pageDescription"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="ac-input w-full resize-y rounded-lg border-zinc-200 bg-white px-3 py-2.5"
                  placeholder="Describe this page (optional)"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pageName.trim() || creating}
                  className="ac-btn rounded-lg px-4 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
