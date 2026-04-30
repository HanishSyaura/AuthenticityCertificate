import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useEpcStore from '../../store/useEpcStore';
import useMediaStore from '../../store/useMediaStore';
import { useT } from '../../i18n/useT';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function AdminCertificateList() {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBackground, setNewBackground] = useState('');
  const [newBgUploading, setNewBgUploading] = useState(false);
  const [newBgError, setNewBgError] = useState(null);
  const [newBgFileKey, setNewBgFileKey] = useState(0);
  const [newError, setNewError] = useState(null);

  const { templates, loading, error, fetchTemplates, createTemplate } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    loading: s.loading,
    error: s.error,
    fetchTemplates: s.fetchTemplates,
    createTemplate: s.createTemplate
  }));

  const { batches, fetchBatches } = useEpcStore((s) => ({
    batches: s.batches,
    fetchBatches: s.fetchBatches
  }));

  const { uploadMedia } = useMediaStore((s) => ({ uploadMedia: s.uploadMedia }));

  useEffect(() => {
    void fetchTemplates();
    void fetchBatches({ limit: 200, offset: 0 });
  }, [fetchBatches, fetchTemplates]);

  useEffect(() => {
    const shouldOpen = Boolean(location?.state?.openCreate);
    if (!shouldOpen) return;
    setCreateOpen(true);
    navigate('/admin/certificates', { replace: true, state: {} });
  }, [location?.state?.openCreate, navigate]);

  const assignedCountByTemplateId = useMemo(() => {
    const map = new Map();
    for (const b of Array.isArray(batches) ? batches : []) {
      const tid = b?.certificateTemplateId != null ? String(b.certificateTemplateId) : null;
      if (!tid) continue;
      map.set(tid, (map.get(tid) || 0) + 1);
    }
    return map;
  }, [batches]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{t('certificateList')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('certificateListSubtitle')}</p>
        </div>
        <button
          type="button"
          className="ac-btn px-3 py-2 text-xs"
          onClick={() => {
            setNewError(null);
            setNewBgError(null);
            setCreateOpen(true);
          }}
        >
          {t('addCertificate')}
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1fr_120px_140px_110px] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
          <div>{t('name')}</div>
          <div>{t('fields')}</div>
          <div>{t('epcBatches')}</div>
          <div>{t('created')}</div>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-zinc-600">{t('loading')}</div>
        ) : (Array.isArray(templates) ? templates : []).length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-sm font-semibold text-zinc-900">{t('noCertificates')}</div>
            <div className="mt-1 text-xs text-zinc-600">{t('noCertificatesHint')}</div>
          </div>
        ) : (
          (Array.isArray(templates) ? templates : []).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => navigate(`/admin/certificates/${tpl.id}`)}
              className="grid w-full grid-cols-[1fr_120px_140px_110px] gap-3 border-b border-zinc-100 px-4 py-3 text-left text-xs text-zinc-800 hover:bg-zinc-50 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-zinc-900">{tpl.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-500">#{tpl.id}</div>
              </div>
              <div className="text-[11px] text-zinc-700">{Array.isArray(tpl.layoutJson) ? tpl.layoutJson.length : 0}</div>
              <div className="text-[11px] text-zinc-700">{assignedCountByTemplateId.get(String(tpl.id)) || 0}</div>
              <div className="text-[11px] text-zinc-500">{formatDate(tpl.createdAt)}</div>
            </button>
          ))
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">{t('createTemplate')}</div>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => setCreateOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              {newError ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{newError}</div> : null}
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('templateName')}</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('backgroundUrl')}</label>
                <input
                  value={newBackground}
                  onChange={(e) => setNewBackground(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
                <input
                  key={newBgFileKey}
                  type="file"
                  accept="image/*,video/*"
                  disabled={newBgUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setNewBgError(null);
                    setNewBgUploading(true);
                    try {
                      const created = await uploadMedia({ file });
                      if (created?.url) setNewBackground(created.url);
                      setNewBgFileKey((k) => k + 1);
                    } catch (err) {
                      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
                      setNewBgError(msg);
                    } finally {
                      setNewBgUploading(false);
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                {newBgError ? <div className="mt-2 text-xs text-rose-700">{newBgError}</div> : null}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => setCreateOpen(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="ac-btn rounded-lg px-3 py-2 text-xs"
                onClick={async () => {
                  const nm = String(newName || '').trim();
                  if (!nm) return;
                  setNewError(null);
                  try {
                    const created = await createTemplate({
                      name: nm,
                      background: String(newBackground || '').trim() || '',
                      backgroundColor: '#ffffff',
                      layoutJson: [],
                      placeholders: [],
                      canvasWidth: 390,
                      canvasHeight: 844
                    });
                    setCreateOpen(false);
                    setNewName('');
                    setNewBackground('');
                    if (created?.id != null) navigate(`/admin/certificates/${created.id}`);
                  } catch (e) {
                    const msg = e?.response?.data?.message || e?.message || t('createFailed');
                    setNewError(msg);
                  }
                }}
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
