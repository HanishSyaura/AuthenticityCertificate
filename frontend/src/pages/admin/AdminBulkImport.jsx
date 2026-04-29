import React, { useState } from 'react';
import useBulkImportStore from '../../store/useBulkImportStore';
import { useT } from '../../i18n/useT';

export default function AdminBulkImport() {
  const { t } = useT();
  const { loading, error, result, importWorkbook } = useBulkImportStore((s) => ({
    loading: s.loading,
    error: s.error,
    result: s.result,
    importWorkbook: s.importWorkbook
  }));

  const [file, setFile] = useState(null);
  const [dryRun, setDryRun] = useState(true);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">{t('bulkImport')}</h2>
        <div className="mt-1 text-sm text-zinc-600">{t('bulkImportHint')}</div>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-1 text-xs font-semibold text-zinc-600">{t('xlsxFile')}</div>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
              <input
                id="dryRun"
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              <label htmlFor="dryRun">{t('dryRun')}</label>
            </div>
          </div>

          <button
            type="button"
            disabled={!file || loading}
            className="ac-btn px-3 py-2 text-xs"
            onClick={async () => {
              if (!file) return;
              await importWorkbook({ file, dryRun });
            }}
          >
            {loading ? t('loading') : t('import')}
          </button>
        </div>

        <div className="mt-4 text-xs text-zinc-600">
          <div className="font-semibold text-zinc-800">{t('expectedSheets')}</div>
          <div className="mt-1 font-mono text-[11px] text-zinc-700">products, batches, certificates, identities</div>
        </div>
      </div>

      {result ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-semibold text-zinc-600">{t('result')}</div>
          <pre className="mt-2 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

