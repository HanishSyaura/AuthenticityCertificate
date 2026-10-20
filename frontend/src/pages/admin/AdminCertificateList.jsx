import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useCertTemplatesStore from '../../store/useCertTemplatesStore';
import useEpcStore from '../../store/useEpcStore';
import useUploadsStore from '../../store/useUploadsStore';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { useT } from '../../i18n/useT';
import { sortRows } from '../../utils/tableSort';
import DataTable from '../../components/ui/DataTable';
import TablePager from '../../components/ui/TablePager';
import RowActionsMenu from '../../components/ui/RowActionsMenu';
import { normalizePublicMediaPath } from '../../utils/apiBase';
import { MAX_UPLOAD_MB } from '../../utils/uploadLimits';

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function normalizeTemplateId(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) return null;
  return String(n);
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function getTemplateId(tpl) {
  const directValue = normalizeTemplateId(tpl);
  if (directValue) return directValue;
  const direct = normalizeTemplateId(
    pickFirst(tpl, ['id', 'templateId', 'template_id', 'templateID', 'TemplateId', 'TemplateID', 'templateid', 'ID'])
  );
  if (direct) return direct;
  return null;
}

function getCertificateId(tpl) {
  const v = pickFirst(tpl, ['certificateId', 'certificate_id', 'certificateID', 'CertificateId', 'CERTIFICATE_ID']);
  const s = String(v ?? '').trim();
  if (!s) return '';
  const lc = s.toLowerCase();
  if (lc === 'undefined' || lc === 'null') return '';
  return s;
}

function getTemplateName(tpl) {
  const v = pickFirst(tpl, ['name', 'templateName', 'template_name', 'certificateName', 'certificate_name']);
  const s = String(v ?? '').trim();
  if (!s) return '';
  const lc = s.toLowerCase();
  if (lc === 'undefined' || lc === 'null') return '';
  return s;
}

function SectionShell({ title, hint, action, children }) {
  const hasHeader = Boolean(title || hint || action);
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {title ? <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
            {hint ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{hint}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={hasHeader ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}

export default function AdminCertificateList() {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAdminAuthStore((s) => s.user);
  const headerCheckboxRef = useRef(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newCertificateId, setNewCertificateId] = useState('');
  const [newTemplateType, setNewTemplateType] = useState('auth');
  const [newCertificateName, setNewCertificateName] = useState('');
  const [newBackground, setNewBackground] = useState('');
  const [newBgUploading, setNewBgUploading] = useState(false);
  const [newBgError, setNewBgError] = useState(null);
  const [newBgFileKey, setNewBgFileKey] = useState(0);
  const [newError, setNewError] = useState(null);
  const [tableOffset, setTableOffset] = useState(0);
  const [tableLimit, setTableLimit] = useState(50);
  const [tableSort, setTableSort] = useState(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(() => new Set());

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

  const columnPrefsUserKey = useMemo(() => {
    const raw = String(user?.id || user?.email || 'guest').trim().toLowerCase();
    return raw.replace(/[^a-z0-9_-]+/g, '_') || 'guest';
  }, [user?.email, user?.id]);

  function scopedColumnKey(base) {
    return `${base}_${columnPrefsUserKey}`;
  }

  const assignedCountByTemplateId = useMemo(() => {
    const map = new Map();
    for (const b of Array.isArray(batches) ? batches : []) {
      const tid = b?.certificateTemplateId != null ? String(b.certificateTemplateId) : null;
      if (!tid) continue;
      map.set(tid, (map.get(tid) || 0) + 1);
    }
    return map;
  }, [batches]);

  const trimmedNewCertificateId = String(newCertificateId || '').trim();
  const trimmedNewCertificateName = String(newCertificateName || '').trim();
  const canCreate = Boolean(trimmedNewCertificateId && trimmedNewCertificateName) && !newBgUploading;

  const invalidTemplateRows = useMemo(() => {
    const list = Array.isArray(templates) ? templates : [];
    return list.filter((tpl) => !getTemplateId(tpl));
  }, [templates]);

  useEffect(() => {
    setSelectedTemplateIds((prev) => {
      if (!(prev instanceof Set) || prev.size === 0) return prev;
      const validIds = new Set((Array.isArray(templates) ? templates : []).map((tpl) => getTemplateId(tpl)).filter(Boolean));
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [templates]);

  const tableColumns = useMemo(
    () => [
      {
        id: 'select',
        header: (
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            defaultChecked={false}
            aria-label={t('selectAll') || 'Select all'}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 text-[var(--ac-brand)] focus:ring-[var(--ac-brand)]"
          />
        ),
        cell: (tpl) => {
          const id = getTemplateId(tpl);
          const checked = id ? selectedTemplateIds.has(id) : false;
          return (
            <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!id}
                aria-label={t('select') || 'Select'}
                onChange={(e) => {
                  e.stopPropagation();
                  if (!id) return;
                  const nextChecked = e.target.checked;
                  setSelectedTemplateIds((prev) => {
                    const next = new Set(prev);
                    if (nextChecked) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
                className="h-4 w-4 rounded border-slate-300 text-[var(--ac-brand)] focus:ring-[var(--ac-brand)]"
              />
            </span>
          );
        },
        align: 'center',
        width: 52,
        minWidth: 52,
        maxWidth: 52,
        lockedPosition: 'left',
        pinnable: false,
        hideable: false,
        sortable: false,
        resizable: false,
        headerClassName: 'px-3',
        className: 'px-3'
      },
      {
        id: 'name',
        header: t('certificateName'),
        align: 'center',
        sortValue: (tpl) => getTemplateName(tpl) || getCertificateId(tpl) || getTemplateId(tpl) || '',
        minWidth: 220,
        cell: (tpl) => {
          const id = getTemplateId(tpl);
          const nm = getTemplateName(tpl);
          const title = nm || `#${id || ''}`;
          return (
            <div className="min-w-0 text-center">
              <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-xs font-medium text-slate-600">
                {String(tpl?.templateType || 'auth') === 'supporting' ? t('supportingCertificate') : t('authCertificate')}
              </div>
            </div>
          );
        }
      },
      {
        id: 'fields',
        header: t('fields'),
        align: 'center',
        sortValue: (tpl) => (Array.isArray(tpl?.layoutJson) ? tpl.layoutJson.length : 0),
        minWidth: 108,
        cell: (tpl) => <span className="inline-flex w-full justify-center text-sm text-slate-700">{Array.isArray(tpl?.layoutJson) ? tpl.layoutJson.length : 0}</span>
      },
      {
        id: 'batches',
        header: t('epcBatches'),
        align: 'center',
        sortValue: (tpl) => assignedCountByTemplateId.get(String(getTemplateId(tpl) || tpl?.id || '')) || 0,
        minWidth: 120,
        cell: (tpl) => (
          <span className="inline-flex w-full justify-center text-sm text-slate-700">
            {assignedCountByTemplateId.get(String(getTemplateId(tpl) || tpl?.id || '')) || 0}
          </span>
        )
      },
      {
        id: 'created',
        header: t('created'),
        align: 'center',
        sortValue: (tpl) => (tpl?.createdAt ? new Date(tpl.createdAt).getTime() : 0),
        minWidth: 132,
        cell: (tpl) => <span className="inline-flex w-full justify-center text-sm text-slate-500">{formatDate(tpl?.createdAt)}</span>
      },
      {
        id: 'actions',
        header: t('actions'),
        align: 'center',
        width: 84,
        minWidth: 84,
        maxWidth: 84,
        pinnable: false,
        hideable: false,
        sortable: false,
        resizable: false,
        headerClassName: 'px-3',
        className: 'px-3',
        cell: (tpl) => (
          <div className="flex w-full justify-center">
            <RowActionsMenu
              items={[
                {
                  key: 'open',
                  label: t('open'),
                  onSelect: async () => {
                    const id = getTemplateId(tpl);
                    if (!id) return;
                    navigate(`/admin/certificates/${id}`);
                  }
                },
                {
                  key: 'openDesigner',
                  label: t('openDesigner'),
                  onSelect: async () => {
                    const id = getTemplateId(tpl);
                    if (!id) return;
                    navigate(`/admin/certificates/${id}/design`);
                  }
                },
                {
                  key: 'duplicate',
                  label: t('duplicate'),
                  onSelect: async () => {
                    const id = getTemplateId(tpl);
                    if (!id) return;
                    const created = await duplicateTemplate({ id });
                    if (created?.id != null) navigate(`/admin/certificates/${created.id}`);
                  }
                }
              ]}
            />
          </div>
        )
      }
    ],
    [assignedCountByTemplateId, duplicateTemplate, navigate, selectedTemplateIds, t]
  );

  const sortedTemplates = useMemo(
    () => sortRows(Array.isArray(templates) ? templates : [], tableSort, tableColumns),
    [tableColumns, tableSort, templates]
  );

  const pagedTemplates = useMemo(() => {
    const list = Array.isArray(sortedTemplates) ? sortedTemplates : [];
    const total = list.length;
    const safeOffset = total === 0 ? 0 : Math.max(0, Math.min(tableOffset, Math.max(0, total - 1)));
    return list.slice(safeOffset, safeOffset + tableLimit);
  }, [sortedTemplates, tableLimit, tableOffset]);

  const visiblePageTemplateIds = useMemo(
    () => pagedTemplates.map((tpl) => getTemplateId(tpl)).filter(Boolean),
    [pagedTemplates]
  );

  const allPageSelected =
    visiblePageTemplateIds.length > 0 && visiblePageTemplateIds.every((id) => selectedTemplateIds.has(id));
  const somePageSelected =
    visiblePageTemplateIds.length > 0 && visiblePageTemplateIds.some((id) => selectedTemplateIds.has(id)) && !allPageSelected;

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = somePageSelected;
  }, [somePageSelected]);

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.checked = allPageSelected;
  }, [allPageSelected]);

  useEffect(() => {
    const headerNode = headerCheckboxRef.current;
    if (!headerNode) return;
    headerNode.onchange = (event) => {
      const nextChecked = event?.target?.checked;
      setSelectedTemplateIds((prev) => {
        const next = new Set(prev);
        visiblePageTemplateIds.forEach((id) => {
          if (nextChecked) next.add(id);
          else next.delete(id);
        });
        return next;
      });
    };
    return () => {
      if (headerNode) headerNode.onchange = null;
    };
  }, [visiblePageTemplateIds]);

  async function refreshPage() {
    await fetchTemplates();
    await fetchBatches({ limit: 200, offset: 0 });
  }

  return (
    <div className="ac-page">
      <div className="space-y-4">
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div> : null}
        {!error && invalidTemplateRows.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {t('certificateTemplatesInvalidResponse', { count: invalidTemplateRows.length })}
          </div>
        ) : null}

        <SectionShell
          title={t('certificateList')}
          hint={t('certificateListSubtitle')}
          action={
            <>
              <button
                type="button"
                className="ac-btn px-4 py-2.5 text-sm"
                data-tour="cert-add"
                onClick={() => {
                  setNewError(null);
                  setNewBgError(null);
                  setNewTemplateType('auth');
                  setCreateOpen(true);
                }}
              >
                {t('addCertificate')}
              </button>
            </>
          }
        >
          <div data-tour="cert-table">
            <DataTable
              minWidth={760}
              rows={pagedTemplates}
              rowKey={(tpl) => getTemplateId(tpl) || tpl?.id || tpl?.templateId || tpl?.template_id}
              sortState={tableSort}
              onSortChange={setTableSort}
              density="compact"
              loading={loading}
              loadingContent={t('loading')}
              emptyContent={
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-900">{t('noCertificates')}</div>
                  <div className="mt-1 text-sm text-slate-600">{t('noCertificatesHint')}</div>
                </div>
              }
              top={
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t('listOfCertificates')}</div>
                  </div>
                  {selectedTemplateIds.size > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3">
                      <div className="text-sm font-semibold text-slate-900">{t('selectedProducts', { value: selectedTemplateIds.size })}</div>
                      <button type="button" className="ac-btn ac-btn-soft px-3 py-2 text-sm" onClick={() => setSelectedTemplateIds(new Set())}>
                        {t('clearSelection')}
                      </button>
                    </div>
                  ) : null}
                </div>
              }
              onRowClick={(tpl) => {
                const id = getTemplateId(tpl);
                if (!id) return;
                navigate(`/admin/certificates/${id}`);
              }}
              bottom={
                <TablePager
                  offset={tableOffset}
                  limit={tableLimit}
                  total={sortedTemplates.length}
                  loading={loading}
                  onOffsetChange={(next) => setTableOffset(next)}
                  onLimitChange={(next) => {
                    setTableLimit(next);
                    setTableOffset(0);
                  }}
                />
              }
              columns={tableColumns}
              columnTools={{
                enabled: true,
                storageKey: scopedColumnKey('ac_certificate_templates_v2'),
                initialPinnedIds: ['select', 'name'],
                defaultColumnWidth: 116
              }}
            />
          </div>
        </SectionShell>
      </div>

      {createOpen ? (
        <div className="ac-overlay-center">
          <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl">
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
                  onChange={(e) => setNewBackground(normalizePublicMediaPath(e.target.value))}
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
                      if (created?.url) setNewBackground(normalizePublicMediaPath(created.url));
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
                disabled={!canCreate}
                className={`ac-btn rounded-lg px-3 py-2 text-xs ${!canCreate ? 'cursor-not-allowed opacity-50' : ''}`.trim()}
                onClick={async () => {
                  const cid = trimmedNewCertificateId;
                  const nm = trimmedNewCertificateName;
                  if (!cid || !nm) {
                    const msg = !cid && !nm ? t('certificateIdAndNameRequired') : !cid ? t('certificateIdRequired') : t('certificateNameRequired');
                    setNewError(msg);
                    return;
                  }
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
