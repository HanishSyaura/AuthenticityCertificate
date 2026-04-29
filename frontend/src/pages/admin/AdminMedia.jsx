import React, { useEffect, useMemo, useState } from 'react';
import useMediaStore from '../../store/useMediaStore';
import { useT } from '../../i18n/useT';

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function AdminMedia() {
  const { t } = useT();
  const { items, loading, error, lastSyncAt, fetchMedia, uploadMedia, deleteMedia } = useMediaStore((s) => ({
    items: s.items,
    loading: s.loading,
    error: s.error,
    lastSyncAt: s.lastSyncAt,
    fetchMedia: s.fetchMedia,
    uploadMedia: s.uploadMedia,
    deleteMedia: s.deleteMedia
  }));

  const [query, setQuery] = useState('');

  useEffect(() => {
    void fetchMedia();
  }, [fetchMedia]);

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const name = String(it.originalName || '').toLowerCase();
      const url = String(it.url || '').toLowerCase();
      const mime = String(it.mimeType || '').toLowerCase();
      return name.includes(q) || url.includes(q) || mime.includes(q);
    });
  }, [items, query]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('mediaLibrary')}</h2>
          <div className="mt-1 text-sm text-zinc-600">{t('mediaLibraryHint')}</div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
            <button type="button" className="underline" onClick={() => void fetchMedia()}>
              {t('refresh')}
            </button>
            {lastSyncAt ? <span>{t('lastUpdated', { value: new Date(lastSyncAt).toISOString().slice(0, 19).replace('T', ' ') })}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />

          <label className="ac-btn ac-btn-soft cursor-pointer px-3 py-2 text-xs">
            {t('upload')}
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                await uploadMedia({ file });
              }}
            />
          </label>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[2fr_1fr_1fr_220px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
              <div>{t('file')}</div>
              <div>{t('mediaType')}</div>
              <div>{t('size')}</div>
              <div className="text-right">{t('actions')}</div>
            </div>

            {loading ? (
              <div className="p-4 text-sm text-zinc-600">{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm font-semibold text-zinc-900">{t('noMedia')}</div>
                <div className="mt-1 text-xs text-zinc-600">{t('noMediaHint')}</div>
              </div>
            ) : (
              filtered.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[2fr_1fr_1fr_220px] gap-4 border-b border-zinc-100 px-4 py-3 text-sm text-zinc-800 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-900">{it.originalName || it.fileName || it.url}</div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{it.url}</div>
                  </div>
                  <div className="text-xs text-zinc-700">{it.mimeType || '-'}</div>
                  <div className="text-xs text-zinc-700">{formatBytes(it.sizeBytes)}</div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                      onClick={async () => {
                        await navigator.clipboard.writeText(String(it.url || ''));
                      }}
                    >
                      {t('copyUrl')}
                    </button>
                    <button
                      type="button"
                      className="ac-btn ac-btn-soft px-3 py-2 text-xs"
                      onClick={async () => {
                        if (!window.confirm(t('confirmDelete'))) return;
                        await deleteMedia({ id: it.id });
                      }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
