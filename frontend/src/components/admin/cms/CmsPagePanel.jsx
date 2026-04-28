import React, { useState } from 'react';
import { useT } from '../../../i18n/useT';

export default function CmsPagePanel({ pages, selectedPageId, onSelectPage, onCreatePage }) {
  const { t } = useT();
  const [newName, setNewName] = useState('Product Page');
  const [newSlug, setNewSlug] = useState('product-page');

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-3 text-xs font-semibold text-zinc-500">{t('pages')}</div>
      <div className="space-y-1">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPage(p.id)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
              String(p.id) === String(selectedPageId) ? 'bg-zinc-900 text-white' : 'text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <div className="font-semibold">{p.name}</div>
            <div className={`text-[11px] ${String(p.id) === String(selectedPageId) ? 'text-white/70' : 'text-zinc-500'}`}>
              {p.slug}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3">
        <div className="text-xs font-semibold text-zinc-700">{t('createPage')}</div>
        <div className="mt-2 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder={t('pageName')}
          />
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder={t('pageSlug')}
          />
          <button
            type="button"
            onClick={() => onCreatePage({ name: newName, slug: newSlug })}
            className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
