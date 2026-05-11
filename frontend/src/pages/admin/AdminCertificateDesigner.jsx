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

export default function AdminCertificateDesigner() {
  const { t } = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const validId = isValidTemplateId(id);

  useEffect(() => {
    if (!id || !validId) {
      navigate('/admin/certificates', { replace: true });
    }
  }, [id, navigate, validId]);

  if (!id || !validId) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" className="text-xs font-semibold underline" onClick={() => navigate('/admin/certificates')}>
            {t('backToList')}
          </button>
          <button type="button" className="text-xs font-semibold underline" onClick={() => navigate(`/admin/certificates/${id}`)}>
            {t('backToBuilder')}
          </button>
        </div>
      </div>
      <AdminCertificateTemplateBuilder initialSelectedId={String(id)} uiMode="designer" />
    </div>
  );
}
