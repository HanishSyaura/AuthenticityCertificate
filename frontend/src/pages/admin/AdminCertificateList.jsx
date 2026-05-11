import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useEpcStore from '../../store/useEpcStore';
import useUploadsStore from '../../store/useUploadsStore';
import { useT } from '../../i18n/useT';
import DataTable from '../../components/ui/DataTable';
import RowActionsMenu from '../../components/ui/RowActionsMenu';
import { MAX_UPLOAD_MB } from '../../utils/uploadLimits';

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
  const [newCertificateId, setNewCertificateId] = useState('');
  const [newTemplateType, setNewTemplateType] = useState('auth');
  const [newCertificateName, setNewCertificateName] = useState('');
  const [newBackground, setNewBackground] = useState('');
  const [newBgUploading, setNewBgUploading] = useState(false);
  const [newBgError, setNewBgError] = useState(null);
  const [newBgFileKey, setNewBgFileKey] = useState(0);
  const [newError, setNewError] = useState(null);

  const { templates, loading, error, fetchTemplates, createTemplate, duplicateTemplate } = useCertTemplatesStore((s) => ({
    templates: s.templates,
    loading: s.loading,
    error: s.error,
    fetchTemplates: s.fetchTemplates,
    createTemplate: s.createTemplate,
    duplicateTemplate: s.duplicateTemplate
  }));

  const { batches, fetchBatches } = useEpcStore((s) => ({
    batches: s.batches,
    fetchBatches: s.fetchBatches
  }));

  const { uploadMedia } = useUploadsStore((s) => ({ uploadMedia: s.uploadMedia }));

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
            setNewTemplateType('auth');
            setCreateOpen(true);
          }}
        >
          {t('addCertificate')}
        </button>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}

      <DataTable
        minWidth={720}
        rows={Array.isArray(templates) ? templates : []}
        rowKey={(tpl) => tpl.id}
        loading={loading}
        loadingContent={t('loading')}
        emptyContent={
          <div>
            <div className="text-sm font-semibold text-zinc-900">{t('noCertificates')}</div>
            <div className="mt-1 text-xs text-zinc-600">{t('noCertificatesHint')}</div>
          </div>
        }
        onRowClick={(tpl) => {
          if (tpl?.id == null) return;
          navigate(`/admin/certificates/${tpl.id}`);
        }}
        columns={[
          {
            id: 'name',
            header: t('certificateName'),
            cell: (tpl) => {
              const nmRaw = String(tpl?.name ?? '').trim();
              const cidRaw = String(tpl?.certificateId ?? '').trim();
              const nm = nmRaw && nmRaw.toLowerCase() !== 'undefined' && nmRaw.toLowerCase() !== 'null' ? nmRaw : '';
              const cid = cidRaw && cidRaw.toLowerCase() !== 'undefined' && cidRaw.toLowerCase() !== 'null' ? cidRaw : '';
              const title = nm || cid || `#${tpl?.id ?? ''}`;
              const subtitle = cid || `#${tpl?.id ?? ''}`;
              return (
                <div className="min-w-0">
                  <div className="truncate font-semibold text-zinc-900">{title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-zinc-500">{subtitle}</div>
                <div className="mt-1 text-[11px] font-semibold text-zinc-600">
                  {String(tpl?.templateType || 'auth') === 'supporting' ? t('supportingCertificate') : t('authCertificate')}
                </div>
                </div>
              );
            }
          },
          {
            id: 'fields',
            header: t('fields'),
            cell: (tpl) => <span className="text-[11px] text-zinc-700">{Array.isArray(tpl.layoutJson) ? tpl.layoutJson.length : 0}</span>
          },
          {
            id: 'batches',
            header: t('epcBatches'),
            cell: (tpl) => <span className="text-[11px] text-zinc-700">{assignedCountByTemplateId.get(String(tpl.id)) || 0}</span>
          },
          { id: 'created', header: t('created'), cell: (tpl) => <span className="text-[11px] text-zinc-500">{formatDate(tpl.createdAt)}</span> },
          {
            id: 'actions',
            header: t('actions'),
            align: 'right',
            headerStyle: { width: 1 },
            cellStyle: { width: 1 },
            cell: (tpl) => (
              <RowActionsMenu
                items={[
                  {
                    key: 'duplicate',
                    label: t('duplicate'),
                    onSelect: async () => {
                      if (!tpl?.id) return;
                      const created = await duplicateTemplate({ id: tpl.id });
                      if (created?.id != null) navigate(`/admin/certificates/${created.id}`);
                    }
                  }
                ]}
              />
            )
          }
        ]}
      />

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
                <label className="block text-xs font-medium text-zinc-700">{t('certificateId')}</label>
                <input
                  value={newCertificateId}
                  onChange={(e) => setNewCertificateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('certificateType')}</label>
                <select
                  value={newTemplateType}
                  onChange={(e) => setNewTemplateType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="auth">{t('authCertificate')}</option>
                  <option value="supporting">{t('supportingCertificate')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">{t('certificateName')}</label>
                <input
                  value={newCertificateName}
                  onChange={(e) => setNewCertificateName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
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
                      const msg = err?.response?.data?.message || err?.message || t('uploadFailed');
                      setNewBgError(msg);
                    } finally {
                      setNewBgUploading(false);
                    }
                  }}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                <div className="mt-1 text-[11px] text-zinc-500">{t('maxFileSize', { mb: MAX_UPLOAD_MB })}</div>
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
                  const cid = String(newCertificateId || '').trim();
                  const nm = String(newCertificateName || '').trim();
                  if (!cid || !nm) return;
                  setNewError(null);
                  try {
                    const created = await createTemplate({
                      certificateId: cid,
                      templateType: newTemplateType,
                      name: nm,
                      background: String(newBackground || '').trim() || '',
                      backgroundColor: '#ffffff',
                      layoutJson: [],
                      placeholders: [],
                      canvasWidth: 390,
                      canvasHeight: 844
                    });
                    setCreateOpen(false);
                    setNewCertificateId('');
                    setNewCertificateName('');
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
