import React, { useMemo, useState } from 'react';
import { useT } from '../../../i18n/useT';

export default function CmsPagePanel({ pages, selectedPageId, onSelectPage, onCreatePage, onDeletePage }) {
  const { t } = useT();
  const [sectionName, setSectionName] = useState('');

  const nextPageNo = useMemo(() => {
    const list = Array.isArray(pages) ? pages : [];
    const maxFromName = list.reduce((max, p) => {
      const name = String(p?.name || '');
      const m = name.match(/^Page\s+(\d+)\b/i) || name.match(/^(\d+)\b/);
      const n = m ? Number(m[1]) : NaN;
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    return Math.max(list.length, maxFromName) + 1;
  }, [pages]);

  const slugify = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');

  return (
    <div className="ac-card p-3">
      <div className="mb-3 text-xs font-semibold text-zinc-500">{t('pages')}</div>
      <div className="space-y-1">
        {pages.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
              String(p.id) === String(selectedPageId) ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200' : 'text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <button type="button" onClick={() => onSelectPage(p.id)} className="min-w-0 flex-1 text-left">
              <div className="truncate font-semibold">{p.name}</div>
              <div className={`truncate text-[11px] ${String(p.id) === String(selectedPageId) ? 'text-brand-700/80' : 'text-zinc-500'}`}>
                {p.slug}
              </div>
            </button>
            {onDeletePage ? (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(t('confirmDelete'))) return;
                  onDeletePage(p.id);
                }}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                {t('delete')}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3">
        <div className="text-xs font-semibold text-zinc-700">{t('createPage')}</div>
        <div className="mt-2 space-y-2">
          <input
            value={String(nextPageNo)}
            disabled
            className="ac-input rounded-lg px-3 py-2"
            placeholder={t('pageName')}
          />
          <input
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            className="ac-input rounded-lg px-3 py-2"
            placeholder={t('pageSlug')}
          />
          <button
            type="button"
            disabled={!sectionName.trim()}
            onClick={() => {
              const section = sectionName.trim();
              const base = slugify(section);
              let slug = base || `page-${nextPageNo}`;
              if ((pages || []).some((p) => String(p?.slug) === slug)) slug = `${slug}-${nextPageNo}`;
              const name = `Page ${nextPageNo}${section ? ` - ${section}` : ''}`;
              onCreatePage({ name, slug });
              setSectionName('');
            }}
            className="ac-btn w-full rounded-lg px-3 py-2 text-sm"
          >
            {t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
