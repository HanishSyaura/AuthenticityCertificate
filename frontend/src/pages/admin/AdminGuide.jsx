import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/useT';
import useTourStore from '../../store/useTourStore';
import { getAdminGettingStartedTourSteps } from '../../tour/adminGettingStartedTour';

export default function AdminGuide() {
  const { t } = useT();
  const navigate = useNavigate();
  const { openTour } = useTourStore((s) => ({ openTour: s.openTour }));

  useEffect(() => {
    openTour({ steps: getAdminGettingStartedTourSteps(t), storageKey: 'ac_seen_admin_tour_v1' });
    navigate('/admin/dashboard', { replace: true });
  }, [navigate, openTour, t]);

  return null;
}
