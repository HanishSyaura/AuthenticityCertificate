import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';

export default function AdminProtected({ children }) {
  const token = useAdminAuthStore((s) => s.token);
  const user = useAdminAuthStore((s) => s.user);
  const loading = useAdminAuthStore((s) => s.loading);
  const fetchMe = useAdminAuthStore((s) => s.fetchMe);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  useEffect(() => {
    if (!user && !loading) void fetchMe();
  }, [user, loading, fetchMe]);

  if (!user && loading) {
    return <div className="p-6 text-sm text-zinc-700">Loading…</div>;
  }

  return children;
}
