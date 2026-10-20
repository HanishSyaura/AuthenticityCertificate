import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminCertificateTemplateBuilder from './AdminCertificateTemplateBuilder';
import { useT } from '../../i18n/useT';

function isValidTemplateId(input) {
  const s = String(input ?? '').trim();
  if (!s) return false;
  const n = Number(s);
  return Number.isInteger(n) && n > 0;
}

export default function AdminCertificateBuilder() {
  const { t } = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const validId = isValidTemplateId(id);

  useEffect(() => {
    if (!id) {
      navigate('/admin/certificates', { replace: true, state: { openCreate: true } });
      return;
    }
    if (!validId) {
      navigate('/admin/certificates', { replace: true });
    }
  }, [id, navigate, validId]);

  if (!id || !validId) return null;

  return (
    <div className="ac-page pb-0">
      <div className="ac-topbar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-zinc-900">{t('certTplHeading')}</div>
          <div className="mt-1 text-sm text-zinc-600">{t('certTplSubheading')}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ac-btn ac-btn-soft rounded-xl px-4 py-2 text-sm"
            onClick={() => navigate('/admin/certificates')}
          >
            {t('backToList')}
          </button>
          <button
            type="button"
            className="ac-btn rounded-xl px-4 py-2 text-sm"
            onClick={() => navigate(`/admin/certificates/${id}/design`)}
          >
            {t('openDesigner')}
          </button>
        </div>
      </div>
      <AdminCertificateTemplateBuilder initialSelectedId={id ? String(id) : null} />
    </div>
  );
}
