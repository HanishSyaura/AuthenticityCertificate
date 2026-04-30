import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminCertificateTemplateBuilder from './AdminCertificateTemplateBuilder';
import { useT } from '../../i18n/useT';

export default function AdminCertificateBuilder() {
  const { t } = useT();
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (!id) {
      navigate('/admin/certificates', { replace: true, state: { openCreate: true } });
    }
  }, [id, navigate]);

  if (!id) return null;

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6 lg:px-8">
        <button type="button" className="text-xs font-semibold underline" onClick={() => navigate('/admin/certificates')}>
          {t('backToList')}
        </button>
      </div>
      <AdminCertificateTemplateBuilder initialSelectedId={id ? String(id) : null} />
    </div>
  );
}
