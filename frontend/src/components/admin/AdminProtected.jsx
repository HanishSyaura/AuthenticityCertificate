import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import useAdminAuthStore from '../../store/useAdminAuthStore';
import { ADMIN_UNAUTHORIZED_EVENT } from '../../utils/adminApi';

export default function AdminProtected({ children }) {
  const token = useAdminAuthStore((s) => s.token);
  const user = useAdminAuthStore((s) => s.user);
  const loading = useAdminAuthStore((s) => s.loading);
  const fetchMe = useAdminAuthStore((s) => s.fetchMe);
  const logout = useAdminAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const lastTokenRef = useRef(null);

  useEffect(() => {
    if (!token) {
      lastTokenRef.current = null;
      return;
    }
    if (lastTokenRef.current === token) return;
    lastTokenRef.current = token;
    void fetchMe();
  }, [fetchMe, token]);

  useEffect(() => {
    const onUnauthorized = () => {
      logout();
      navigate('/admin/login', { replace: true, state: { from: location.pathname } });
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [location.pathname, logout, navigate]);

  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!user && loading) {
    return <div className="p-6 text-sm text-zinc-700">Loading…</div>;
  }

  return children;
}
