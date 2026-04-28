import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';

export default function AdminProtected({ children }) {
  const token = useAdminAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

